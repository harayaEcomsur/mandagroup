import { createHmac, timingSafeEqual } from "node:crypto";
import { stepCountIs, type ModelMessage } from "ai";
import { generateTextWithFallback } from "@/lib/gemini";
import { clientConfig } from "@/config/client.config";
import { buildSystemPrompt } from "@/lib/assistant-prompt";
import { buildAgendaTools } from "@/lib/chat-tools";
import { buildLeadTools } from "@/lib/lead-tools";
import { buildStoreTools } from "@/lib/store-tools";
import { buildMandagroupTools } from "@/lib/mandagroup-tools";
import { getInstagramScope, type InstagramScope } from "@/lib/mandagroup-store";
import { logChat } from "@/lib/chat-log";
import {
  getHistory,
  appendHistory,
  recordBotMessageId,
  wasSentByBot,
  pauseForHuman,
  isHumanPaused,
} from "@/lib/ig-history";

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

// Los tokens "IGAA..." (Instagram API with Instagram Login, la API actual)
// solo funcionan contra graph.instagram.com — graph.facebook.com es el host
// de la Messenger Platform clásica y los rechaza con "Cannot parse access
// token" aunque el token sea válido. lib/instagram.ts (el feed) ya usaba el
// host correcto; este webhook se había quedado con el antiguo.
const GRAPH_URL = "https://graph.instagram.com/v25.0";

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
//
// Importante: el HMAC se calcula sobre los BYTES crudos del body (Buffer), no
// sobre un string ya decodificado — pasar por un string intermedio puede no
// reconstruir exactamente los mismos bytes que Meta firmó.
function verifySignature(rawBody: Buffer, signatureHeader: string | null): boolean {
  const secret = process.env.INSTAGRAM_APP_SECRET;
  if (!secret) return true; // sin secreto configurado: no se verifica
  if (!signatureHeader?.startsWith("sha256=")) return false;
  const expected = "sha256=" + createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(signatureHeader);
  const b = Buffer.from(expected);
  const matches = a.length === b.length && timingSafeEqual(a, b);
  if (!matches) {
    // Log temporal de diagnóstico — no expone el secreto, solo las firmas
    // (ya públicas: la recibida viaja en un header que no es secreto) y el
    // largo del body, para entender por qué no calzan.
    console.warn("[instagram webhook] firma no coincide", {
      recibida: signatureHeader,
      esperada: expected,
      bodyBytes: rawBody.length,
    });
  }
  return matches;
}

// Para clientes con una sola cuenta de Instagram, `igAccountId` nunca matchea
// nada en `instagramAccounts` (vacío u omitido) y esto cae directo a
// INSTAGRAM_TOKEN, igual que antes — sin cambios para ellos.
function resolveInstagramToken(igAccountId: string | undefined): string | undefined {
  const envVarName = igAccountId ? clientConfig.instagramAccounts?.[igAccountId] : undefined;
  return (envVarName && process.env[envVarName]) || process.env.INSTAGRAM_TOKEN;
}

// Nombre real de quien escribe (para saludar por su nombre en vez de un mote
// genérico). Requiere que la persona ya le haya escrito al negocio (consentimiento
// implícito) — si Meta no lo entrega (usuario sin nombre público, token sin
// permiso, etc.) seguimos sin nombre, nunca bloqueamos la respuesta por esto.
async function resolveInstagramSenderName(senderId: string, token: string | undefined): Promise<string | undefined> {
  if (!token) return undefined;
  try {
    const res = await fetch(`${GRAPH_URL}/${senderId}?fields=name,username&access_token=${token}`);
    if (!res.ok) {
      console.warn("[instagram webhook] resolveInstagramSenderName falló", {
        status: res.status,
        body: await res.text().catch(() => "(no se pudo leer)"),
      });
      return undefined;
    }
    const data = (await res.json()) as { name?: string; username?: string };
    return data.name || data.username || undefined;
  } catch (error) {
    console.warn("[instagram webhook] resolveInstagramSenderName error", error);
    return undefined;
  }
}

// Las 3 funciones de envío devuelven el `message_id` que Meta asigna (o
// `undefined` si falló) — se usa para que recordBotMessageId() lo marque como
// "nuestro" y así un eco de ESTE mensaje no se confunda con una persona real
// respondiendo a mano (ver detección de toma de control humano más abajo).
async function sendInstagramText(recipientId: string, body: string, token: string | undefined): Promise<string | undefined> {
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
  // Diagnóstico temporal: la llamada a la Graph API puede fallar en silencio
  // (token vencido, permiso faltante, cuenta no autorizada) y antes no quedaba
  // registro de eso en ningún lado.
  if (!res.ok) {
    console.warn("[instagram webhook] sendInstagramText falló", {
      status: res.status,
      body: await res.text().catch(() => "(no se pudo leer)"),
    });
    return undefined;
  }
  const data = (await res.json().catch(() => null)) as { message_id?: string } | null;
  return data?.message_id;
}

// Button template de Meta (hasta 3 botones "web_url"): se manda como mensaje
// aparte después del texto, porque la Send API no permite texto + botones en
// un mismo mensaje. `clientConfig.instagramActionButtons` define los botones.
async function sendInstagramButtons(
  recipientId: string,
  buttons: { title: string; url: string }[],
  token: string | undefined,
): Promise<string | undefined> {
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
  if (!res.ok) {
    console.warn("[instagram webhook] sendInstagramButtons falló", {
      status: res.status,
      body: await res.text().catch(() => "(no se pudo leer)"),
    });
    return undefined;
  }
  const data = (await res.json().catch(() => null)) as { message_id?: string } | null;
  return data?.message_id;
}

// Imagen por URL pública (ej. la foto real del dress code) — dispara cuando el
// modelo usa la tool enviar_dresscode (ver lib/mandagroup-tools.ts).
async function sendInstagramImage(recipientId: string, imageUrl: string, token: string | undefined): Promise<string | undefined> {
  const res = await fetch(`${GRAPH_URL}/me/messages?access_token=${token}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      recipient: { id: recipientId },
      message: { attachment: { type: "image", payload: { url: imageUrl, is_reusable: true } } },
      messaging_type: "RESPONSE",
    }),
  });
  if (!res.ok) {
    console.warn("[instagram webhook] sendInstagramImage falló", {
      status: res.status,
      body: await res.text().catch(() => "(no se pudo leer)"),
    });
    return undefined;
  }
  const data = (await res.json().catch(() => null)) as { message_id?: string } | null;
  return data?.message_id;
}

const VENUE_LABEL = { renaca: "Manda Reñaca", vina: "Manda Viña del Mar" } as const;

// Botones sin `kind` (clientes que no usan alcance por cuenta) siempre se
// muestran — el filtro solo actúa cuando hay un scope guardado para la cuenta.
function filterButtonsByScope(
  buttons: { title: string; url: string; kind?: "tickets-renaca" | "tickets-vina" | "reserva" }[] | undefined,
  scope: InstagramScope | undefined,
): { title: string; url: string }[] {
  if (!buttons?.length) return [];
  if (!scope) return buttons;
  return buttons.filter((b) => {
    if (b.kind === "reserva") return scope.allowReservations;
    if (b.kind === "tickets-renaca") return scope.venues.includes("renaca");
    if (b.kind === "tickets-vina") return scope.venues.includes("vina");
    return true;
  });
}

export async function POST(req: Request) {
  // Siempre responder 200 rápido: si Meta recibe errores, reintenta y puede
  // desactivar el webhook. Los problemas se registran en logs, no en el status.
  const configured =
    process.env.GEMINI_API_KEY && (process.env.INSTAGRAM_TOKEN || clientConfig.instagramAccounts);

  // Cuerpo crudo como bytes (no texto): el HMAC se valida sobre los bytes
  // exactos que mandó Meta, antes de cualquier decodificación.
  let rawBytes: Buffer;
  try {
    rawBytes = Buffer.from(await req.arrayBuffer());
  } catch {
    return Response.json({ ok: true });
  }

  if (!verifySignature(rawBytes, req.headers.get("x-hub-signature-256"))) {
    console.warn("[instagram webhook] firma inválida — payload descartado");
    return Response.json({ ok: true });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBytes.toString("utf8"));
  } catch {
    return Response.json({ ok: true });
  }

  if (!configured) return Response.json({ ok: true, note: "instagram no configurado" });

  try {
    // Estructura estándar del webhook: entry[].messaging[]
    const messaging = (payload as any)?.entry?.[0]?.messaging?.[0];

    // Diagnóstico temporal: ver exactamente qué llega, para saber en qué
    // punto se corta si no hay respuesta (payload inesperado, echo, etc.).
    console.log("[instagram webhook] payload recibido", JSON.stringify(payload).slice(0, 2000));

    if (!messaging) return Response.json({ ok: true });

    // Eco de un mensaje SALIENTE de la cuenta (nuestro bot o una persona del
    // equipo escribiendo a mano desde la app de Instagram — Meta manda este
    // mismo evento para ambos casos, sin distinguir el origen). En un eco,
    // sender/recipient vienen invertidos: sender es la cuenta del negocio,
    // recipient es la persona real. Si el mid no es de los que registramos al
    // enviar, es una persona real ya respondiendo: pausamos el bot para ese
    // hilo, para no pisarle la respuesta.
    if (messaging.message?.is_echo) {
      const customerId: string | undefined = messaging.recipient?.id;
      const mid: string | undefined = messaging.message?.mid;
      if (customerId && !(await wasSentByBot(customerId, mid))) {
        console.log("[instagram webhook] eco ajeno — una persona ya está respondiendo, se pausa el bot", { customerId });
        await pauseForHuman(customerId);
      }
      return Response.json({ ok: true });
    }

    // Mención o respuesta a una historia: no es una pregunta real, y
    // responder con el flujo normal del asistente queda fuera de contexto.
    const isStoryMention = Array.isArray(messaging.message?.attachments)
      ? messaging.message.attachments.some((a: { type?: string }) => a?.type === "story_mention")
      : false;
    const isStoryReply = Boolean(messaging.message?.reply_to?.story);
    if (isStoryMention || isStoryReply) {
      console.log("[instagram webhook] descartado: mención/respuesta a historia", { isStoryMention, isStoryReply });
      return Response.json({ ok: true });
    }

    // Reacciones, "seen" y tipos no soportados en v1 (solo texto).
    if (!messaging.message?.text) {
      console.log("[instagram webhook] descartado: sin texto", { hasMessaging: !!messaging });
      return Response.json({ ok: true });
    }

    const from: string = messaging.sender?.id;
    const userText: string = messaging.message.text;
    if (!from) return Response.json({ ok: true });

    if (await isHumanPaused(from)) {
      console.log("[instagram webhook] hilo pausado por toma de control humano, no se responde", { from });
      return Response.json({ ok: true, note: "pausado por humano" });
    }

    // `recipient.id` es la cuenta de Instagram que recibió el mensaje — con
    // varias cuentas conectadas a la misma app, decide con cuál responder.
    const igAccountId: string | undefined = messaging.recipient?.id;
    const scope = await getInstagramScope(igAccountId);

    // Cuenta desactivada desde /eventos/admin: no responde nada — queda para
    // que el equipo la atienda a mano, sin el asistente de por medio.
    if (scope?.enabled === false) {
      console.log("[instagram webhook] cuenta desactivada, no se responde", { igAccountId });
      return Response.json({ ok: true, note: "cuenta desactivada" });
    }

    const token = resolveInstagramToken(igAccountId);
    const senderName = await resolveInstagramSenderName(from, token);
    console.log("[instagram webhook] procesando", { from, igAccountId, hasToken: !!token, senderName, scope, userText });

    // Historial corto por IGSID: permite completar el flujo de agendar en
    // varios mensajes (servicio → hora → nombre) como en el chat del sitio.
    const history: ModelMessage[] = (await getHistory(from)).map((t) => ({ role: t.role, content: t.content }));

    const { text, toolResults } = await generateTextWithFallback(clientConfig.chat.model, {
      system:
        buildSystemPrompt() +
        "\n\nEstás respondiendo por Instagram Direct: sé especialmente breve (2-4 frases), sin markdown ni asteriscos." +
        " Si el mensaje del cliente es ambiguo o te falta un dato para ayudarlo, pide que te lo aclare en vez de adivinar." +
        " Si de verdad no sabes algo (está fuera de lo que puedes resolver: reservas, entradas, dress code, ubicación, horarios), dilo con naturalidad y dile que alguien del equipo le responderá por este mismo chat — nunca inventes ni adivines una respuesta." +
        (senderName
          ? `\n\nEl nombre de quien te escribe es "${senderName}" — salúdalo(a) por su nombre en vez de usar un mote genérico, y úsalo también más adelante en la conversación si se da natural (sin forzarlo en cada frase).`
          : "") +
        (scope
          ? `\n\nIMPORTANTE: esta cuenta de Instagram es solo de ${scope.venues
              .map((v) => VENUE_LABEL[v])
              .join(" y ")} — nunca menciones, ofrezcas ni derives al otro local.${
              scope.allowReservations ? "" : " Tampoco ofrezcas reservas de mesa: no se coordinan por este canal, solo entradas/eventos."
            }`
          : ""),
      messages: [...history, { role: "user", content: userText }],
      maxOutputTokens: clientConfig.chat.maxTokensPerReply,
      tools: {
        ...buildAgendaTools(),
        ...buildLeadTools(),
        ...buildStoreTools(),
        ...buildMandagroupTools("instagram", userText, scope),
      },
      stopWhen: stepCountIs(5),
    });

    if (text?.trim()) {
      const textMid = await sendInstagramText(from, text.trim(), token);
      await recordBotMessageId(from, textMid);

      // enviar_dresscode (ver lib/mandagroup-tools.ts) devuelve la URL de la
      // imagen real — si el modelo la usó en este turno, se manda aparte.
      const dresscodeResult = toolResults?.find((r) => r.toolName === "enviar_dresscode")?.output as
        | { image_url?: string }
        | undefined;
      const dresscodeImageUrl = dresscodeResult?.image_url;
      if (dresscodeImageUrl) {
        const imageMid = await sendInstagramImage(from, dresscodeImageUrl, token);
        await recordBotMessageId(from, imageMid);
      }

      const buttons = filterButtonsByScope(clientConfig.instagramActionButtons, scope);
      if (buttons.length) {
        const buttonsMid = await sendInstagramButtons(from, buttons, token);
        await recordBotMessageId(from, buttonsMid);
      }
      await appendHistory(from, { role: "user", content: userText }, { role: "assistant", content: text.trim() });
      logChat({ canal: "instagram", userText, assistantText: text.trim() });
    }
  } catch (error) {
    console.error("[instagram webhook]", error);
  }

  return Response.json({ ok: true });
}
