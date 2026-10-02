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
import { getHistory, appendHistory } from "@/lib/wa-history";

// Webhook de WhatsApp Business Cloud API: el mismo asistente del sitio
// respondiendo el WhatsApp del negocio (módulo "Asistente IA en tu WhatsApp").
//
// Setup por cliente (ver README → "Asistente en WhatsApp"):
//   WHATSAPP_VERIFY_TOKEN   — string secreto que eliges tú; se repite en el panel de Meta
//   WHATSAPP_TOKEN          — token permanente de la app de Meta (System User)
//   WHATSAPP_PHONE_NUMBER_ID — ID del número (no el número) en WhatsApp Manager
// Con Coexistence, el cliente sigue usando su app de WhatsApp Business normal.
export const runtime = "nodejs";

const GRAPH_URL = "https://graph.facebook.com/v21.0";

// Verificación del webhook (Meta hace un GET al registrar la URL).
export async function GET(req: Request) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  if (mode === "subscribe" && token && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new Response(challenge ?? "", { status: 200 });
  }
  return new Response("Forbidden", { status: 403 });
}

// Verifica la firma HMAC-SHA256 que Meta pone en X-Hub-Signature-256 sobre el
// cuerpo CRUDO. Opt-in: solo se exige si WHATSAPP_APP_SECRET está configurado
// (el App Secret de la app de Meta). Sin él, el webhook sigue funcionando pero
// queda abierto — por eso conviene setearlo en producción para que nadie inyecte
// mensajes falsos y gaste tokens/mensajes. Devuelve true si NO hay secreto (no
// se puede/quiere verificar) o si la firma calza.
function verifySignature(rawBody: string, signatureHeader: string | null): boolean {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret) return true; // sin secreto configurado: no se verifica
  if (!signatureHeader?.startsWith("sha256=")) return false;
  const expected = "sha256=" + createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(signatureHeader);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function sendWhatsAppText(to: string, body: string): Promise<boolean> {
  const res = await fetch(`${GRAPH_URL}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      // 4096 es el máximo de WhatsApp; el asistente responde corto igual.
      text: { body: body.slice(0, 4000) },
    }),
  });
  // El envío puede fallar (token vencido, número mal configurado, ventana de
  // 24h cerrada) sin que Next.js lo vea como una excepción — sin este log, un
  // fallo de envío queda invisible (el webhook igual responde 200 a Meta).
  if (!res.ok) {
    console.error("[whatsapp webhook] fallo al enviar:", res.status, await res.text().catch(() => ""));
  }
  return res.ok;
}

export async function POST(req: Request) {
  // Siempre responder 200 rápido: si Meta recibe errores, reintenta y puede
  // desactivar el webhook. Los problemas se registran en logs, no en el status.
  const configured =
    process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.GEMINI_API_KEY;

  // Cuerpo crudo primero: se necesita tal cual para validar la firma de Meta.
  let raw: string;
  try {
    raw = await req.text();
  } catch {
    return Response.json({ ok: true });
  }

  // Firma HMAC de Meta (si WHATSAPP_APP_SECRET está seteado). Un payload sin
  // firma válida se descarta en silencio con 200 (no revelar el motivo).
  if (!verifySignature(raw, req.headers.get("x-hub-signature-256"))) {
    console.warn("[whatsapp webhook] firma inválida — payload descartado");
    return Response.json({ ok: true });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return Response.json({ ok: true });
  }

  if (!configured) return Response.json({ ok: true, note: "whatsapp no configurado" });

  try {
    // Estructura estándar del webhook: entry[].changes[].value.messages[]
    const value = (payload as any)?.entry?.[0]?.changes?.[0]?.value;
    const message = value?.messages?.[0];

    // Ignorar estados de entrega/lectura y tipos no soportados en v1.
    if (!message || message.type !== "text" || !message.text?.body) {
      return Response.json({ ok: true });
    }

    const from: string = message.from;
    const userText: string = message.text.body;

    // Historial corto por número: permite completar el flujo de agendar en
    // varios mensajes (servicio → hora → nombre) como en el chat del sitio.
    const history: ModelMessage[] = (await getHistory(from)).map((t) => ({ role: t.role, content: t.content }));

    const { text } = await generateTextWithFallback(clientConfig.chat.model, {
      system:
        buildSystemPrompt() +
        "\n\nEstás respondiendo por WhatsApp, escribe como una persona real texteando, no como un bot de atención al cliente:\n" +
        "- Corto: 2-4 frases como máximo, nunca un párrafo corrido.\n" +
        "- SEPARA las ideas en líneas distintas dejando una línea en blanco entre ellas (un salto de línea real, no una coma ni un punto seguido) — así se ve la conversación en WhatsApp, en burbujas cortas, no como un bloque de texto.\n" +
        "- Tono cálido y directo, como si le escribieras a un conocido: usa contracciones naturales, evita sonar corporativo o acartonado, evita frases de manual (\"estamos para ayudarte en lo que necesites\").\n" +
        "- Formato propio de WhatsApp (no es markdown estándar): *negrita* con UN solo asterisco pegado a la palabra (nunca dobles — '**así**' se ve roto y '* así *' con espacios tampoco funciona), _cursiva_ igual con guión bajo pegado. Úsalo cuando de verdad ayude a destacar algo (un horario, un nombre), no en cada frase.\n" +
        "- Algún emoji cuando aporte calidez de verdad (😊🦷📅), sin abusar — nunca uno por frase.\n" +
        "- Nunca uses encabezados con '#', tablas, ni listas numeradas con formato — WhatsApp los muestra como texto plano tal cual.\n" +
        "Si el cliente necesita atención humana, dile que alguien del equipo le responderá por este mismo chat.",
      messages: [...history, { role: "user", content: userText }],
      maxOutputTokens: clientConfig.chat.maxTokensPerReply,
      tools: { ...buildAgendaTools(), ...buildLeadTools(), ...buildStoreTools(), ...buildMandagroupTools("whatsapp", userText) },
      stopWhen: stepCountIs(5),
    });

    if (text?.trim()) {
      await sendWhatsAppText(from, text.trim());
      await appendHistory(from, { role: "user", content: userText }, { role: "assistant", content: text.trim() });
      logChat({ canal: "whatsapp", userText, assistantText: text.trim() });
    } else {
      console.warn("[whatsapp webhook] el modelo no devolvió texto para:", userText);
    }
  } catch (error) {
    console.error("[whatsapp webhook]", error);
  }

  return Response.json({ ok: true });
}
