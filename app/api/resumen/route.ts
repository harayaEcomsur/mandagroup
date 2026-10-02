import { clientConfig } from "@/config/client.config";
import { generateTextWithFallback } from "@/lib/gemini";
import { recentChats } from "@/lib/chat-log";
import { listBookings } from "@/lib/booking-store";
import { notifyByEmail, notifyByWhatsApp, defaultOwnerWhatsapp } from "@/lib/booking-actions";

// Resumen diario para el DUEÑO: un cron llama este endpoint una vez al día y
// le llega por email/WhatsApp qué hizo el asistente en las últimas 24h
// (conversaciones atendidas, quiénes quieren cotizar, reservas nuevas).
export const runtime = "nodejs";

// Acepta el formato de Vercel Cron (Authorization: Bearer CRON_SECRET) o la
// clave de admin de la agenda por query, para probarlo a mano desde el browser.
function isAuthorized(req: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && req.headers.get("authorization") === `Bearer ${cronSecret}`) return true;
  const adminKey = process.env.AGENDA_ADMIN_KEY;
  if (adminKey && new URL(req.url).searchParams.get("clave") === adminKey) return true;
  return false;
}

const MAX_CHATS = 40; // interacciones que van al modelo
const MAX_TEXT = 300; // chars por texto: mantiene el prompt acotado

function truncate(s: string, max = MAX_TEXT): string {
  return s.length > max ? s.slice(0, max) + "…" : s;
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) return Response.json({ error: "No autorizado" }, { status: 401 });

  try {
    const chats = await recentChats(24);
    const since = Date.now() - 24 * 60 * 60 * 1000;
    const bookings = (await listBookings()).filter((b) => {
      const created = Date.parse(b.createdAt);
      return Number.isFinite(created) && created >= since;
    });

    // Sin actividad no hay nada que resumir: ni modelo ni avisos.
    if (chats.length === 0 && bookings.length === 0) {
      return Response.json({ ok: true, skipped: "sin actividad" });
    }

    const businessName = clientConfig.meta.businessName;

    const chatsContext = chats
      .slice(-MAX_CHATS)
      .map((c) => `[${c.canal}] Cliente: ${truncate(c.userText)}\nAsistente: ${truncate(c.assistantText)}`)
      .join("\n---\n");
    const bookingsContext = bookings
      .map((b) => `- ${b.service} el ${b.date} a las ${b.time} — ${b.name} (${b.phone}) [${b.status}]`)
      .join("\n");

    const { text: resumen } = await generateTextWithFallback(clientConfig.chat.model, {
      prompt: [
        `Eres el asistente de ${businessName}. Redacta un resumen breve del día (máximo 8 líneas, sin markdown, tono cercano chileno) para el DUEÑO del negocio.`,
        `Incluye: cuántas conversaciones atendiste, los temas más repetidos, clientes que dejaron datos o pidieron cotizar/agendar (nombre y teléfono si aparecen en las conversaciones), y las reservas nuevas del día (servicio/fecha/hora/nombre).`,
        `Cierra con 1 sugerencia accionable para el dueño.`,
        ``,
        `Conversaciones de las últimas 24h (${chats.length} en total):`,
        chatsContext || "(ninguna)",
        ``,
        `Reservas nuevas de las últimas 24h:`,
        bookingsContext || "(ninguna)",
      ].join("\n"),
    });

    // Mismo criterio de destinos que booking-actions: config del cliente con
    // fallback a las variables de entorno.
    const ownerEmail = clientConfig.booking?.ownerNotifyEmail ?? process.env.BOOKINGS_NOTIFY_EMAIL;
    const ownerWhatsapp = defaultOwnerWhatsapp();

    const [emailSent, whatsappSent] = await Promise.all([
      notifyByEmail(`🌙 Resumen del día — ${businessName}`, resumen, ownerEmail),
      ownerWhatsapp && process.env.NOTIFY_WA_TOKEN
        ? notifyByWhatsApp(ownerWhatsapp, resumen)
        : Promise.resolve(false),
    ]);

    return Response.json({
      ok: true,
      conversaciones: chats.length,
      reservas: bookings.length,
      emailSent,
      whatsappSent,
      resumen,
    });
  } catch (error) {
    // Nunca filtrar secretos ni el detalle interno del error en la respuesta.
    console.error("Error generando el resumen diario:", error);
    return Response.json({ error: "No se pudo generar el resumen del día" }, { status: 500 });
  }
}
