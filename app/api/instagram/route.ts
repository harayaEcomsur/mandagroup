import { createHmac, timingSafeEqual } from "node:crypto";
import { stepCountIs, type ModelMessage } from "ai";
import { generateTextWithFallback } from "@/lib/gemini";
import { clientConfig } from "@/config/client.config";
import { buildSystemPrompt } from "@/lib/assistant-prompt";
import { buildAgendaTools } from "@/lib/chat-tools";
import { buildLeadTools } from "@/lib/lead-tools";
import { buildStoreTools } from "@/lib/store-tools";
import { buildMandagroupTools } from "@/lib/mandagroup-tools";
import { logChat } from "@/lib/chat-log";
import { getHistory, appendHistory } from "@/lib/ig-history";

// Webhook de Instagram Direct (Messenger Platform / Instagram Messaging API de
// Meta): el mismo asistente del sitio respondiendo los DM de Instagram del
// negocio — mismo patrón que app/api/whatsapp/route.ts, adaptado al payload
// de Instagram (entry[].messaging[], no entry[].changes[].value.messages[]).
//
// Setup por cliente (ver README → "Asistente en Instagram"):
//   INSTAGRAM_VERIFY_TOKEN — string secreto que eliges tú; se repite en el panel de Meta
//   INSTAGRAM_TOKEN        — Page Access Token de la app de Meta, con permiso
//                            instagram_manage_messages (la cuenta de Instagram debe
//                            ser profesional y estar vinculada a una Página de Facebook)
//   INSTAGRAM_APP_SECRET   — opcional, mismo mecanismo que WHATSAPP_APP_SECRET
//
// Clientes con más de una cuenta de Instagram (varios locales): define
// `instagramAccounts` en client.config.ts mapeando el ID de cada cuenta al
// nombre de SU env var de token — ver resolveInstagramToken más abajo.
export const runtime = "nodejs";

const GRAPH_URL = "https://graph.facebook.com/v21.0";

// Verificación del webhook (Meta hace un GET al registrar la URL).
export async function GET(req: Request) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  if (mode === "subscribe" && token && token === process.env.INSTAGRAM_VERIFY_TOKEN) {
    return new Response(challenge ?? "", { status: 200 });
  }
  return new Response("Forbidden", { status: 403 });
}

// Verifica la firma HMAC-SHA256 que Meta pone en X-Hub-Signature-256 sobre el
// cuerpo CRUDO. Opt-in: solo se exige si INSTAGRAM_APP_SECRET está configurado.
// Sin él, el webhook sigue funcionando pero queda abierto — conviene setearlo en
// producción para que nadie inyecte mensajes falsos y gaste tokens/mensajes.
function verifySignature(rawBody: string, signatureHeader: string | null): boolean {
  const secret = process.env.INSTAGRAM_APP_SECRET;
  if (!secret) return true; // sin secreto configurado: no se verifica
  if (!signatureHeader?.startsWith("sha256=")) return false;
  const expected = "sha256=" + createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(signatureHeader);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

// Para clientes con una sola cuenta de Instagram, `igAccountId` nunca matchea
// nada en `instagramAccounts` (vacío u omitido) y esto cae directo a
// INSTAGRAM_TOKEN, igual que antes — sin cambios para ellos.
function resolveInstagramToken(igAccountId: string | undefined): string | undefined {
  const envVarName = igAccountId ? clientConfig.instagramAccounts?.[igAccountId] : undefined;
  return (envVarName && process.env[envVarName]) || process.env.INSTAGRAM_TOKEN;
}

async function sendInstagramText(recipientId: string, body: string, token: string | undefined): Promise<boolean> {
  const res = await fetch(`${GRAPH_URL}/me/messages?access_token=${token}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      recipient: { id: recipientId },
      // 1000 caracteres es el máximo de un DM de Instagram; el asistente responde corto igual.
      message: { text: body.slice(0, 950) },
      messaging_type: "RESPONSE",
    }),
  });
  return res.ok;
}

// Button template de Meta (hasta 3 botones "web_url"): se manda como mensaje
// aparte después del texto, porque la Send API no permite texto + botones en
// un mismo mensaje. `clientConfig.instagramActionButtons` define los botones.
async function sendInstagramButtons(
  recipientId: string,
  buttons: { title: string; url: string }[],
  token: string | undefined,
): Promise<boolean> {
  const res = await fetch(`${GRAPH_URL}/me/messages?access_token=${token}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      recipient: { id: recipientId },
      message: {
        attachment: {
          type: "template",
          payload: {
            template_type: "button",
            text: "Elige una opción:",
            buttons: buttons.map((b) => ({ type: "web_url", url: b.url, title: b.title })),
          },
        },
      },
      messaging_type: "RESPONSE",
    }),
  });
  return res.ok;
}

export async function POST(req: Request) {
  // Siempre responder 200 rápido: si Meta recibe errores, reintenta y puede
  // desactivar el webhook. Los problemas se registran en logs, no en el status.
  const configured =
    process.env.GEMINI_API_KEY && (process.env.INSTAGRAM_TOKEN || clientConfig.instagramAccounts);

  // Cuerpo crudo primero: se necesita tal cual para validar la firma de Meta.
  let raw: string;
  try {
    raw = await req.text();
  } catch {
    return Response.json({ ok: true });
  }

  if (!verifySignature(raw, req.headers.get("x-hub-signature-256"))) {
    console.warn("[instagram webhook] firma inválida — payload descartado");
    return Response.json({ ok: true });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return Response.json({ ok: true });
  }

  if (!configured) return Response.json({ ok: true, note: "instagram no configurado" });

  try {
    // Estructura estándar del webhook: entry[].messaging[]
    const messaging = (payload as any)?.entry?.[0]?.messaging?.[0];

    // Ignorar eco de nuestros propios mensajes, reacciones, "seen" y tipos no
    // soportados en v1 (solo texto).
    if (!messaging || messaging.message?.is_echo || !messaging.message?.text) {
      return Response.json({ ok: true });
    }

    const from: string = messaging.sender?.id;
    const userText: string = messaging.message.text;
    if (!from) return Response.json({ ok: true });

    // `recipient.id` es la cuenta de Instagram que recibió el mensaje — con
    // varias cuentas conectadas a la misma app, decide con cuál responder.
    const igAccountId: string | undefined = messaging.recipient?.id;
    const token = resolveInstagramToken(igAccountId);

    // Historial corto por IGSID: permite completar el flujo de agendar en
    // varios mensajes (servicio → hora → nombre) como en el chat del sitio.
    const history: ModelMessage[] = (await getHistory(from)).map((t) => ({ role: t.role, content: t.content }));

    const { text } = await generateTextWithFallback(clientConfig.chat.model, {
      system:
        buildSystemPrompt() +
        "\n\nEstás respondiendo por Instagram Direct: sé especialmente breve (2-4 frases), sin markdown ni asteriscos. Si el cliente necesita atención humana, dile que alguien del equipo le responderá por este mismo chat.",
      messages: [...history, { role: "user", content: userText }],
      maxOutputTokens: clientConfig.chat.maxTokensPerReply,
      tools: { ...buildAgendaTools(), ...buildLeadTools(), ...buildStoreTools(), ...buildMandagroupTools("instagram", userText) },
      stopWhen: stepCountIs(5),
    });

    if (text?.trim()) {
      await sendInstagramText(from, text.trim(), token);
      if (clientConfig.instagramActionButtons?.length) {
        await sendInstagramButtons(from, clientConfig.instagramActionButtons, token);
      }
      await appendHistory(from, { role: "user", content: userText }, { role: "assistant", content: text.trim() });
      logChat({ canal: "instagram", userText, assistantText: text.trim() });
    }
  } catch (error) {
    console.error("[instagram webhook]", error);
  }

  return Response.json({ ok: true });
}
