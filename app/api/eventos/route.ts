import { z } from "zod";
import { clientConfig } from "@/config/client.config";
import { currentAdminUser } from "@/lib/auth";
import {
  getReservationNumber,
  setReservationNumber,
  listEvents,
  upsertEvent,
  setEventActive,
  derivationStats,
} from "@/lib/mandagroup-store";
import { recentChats } from "@/lib/chat-log";

// API del panel /eventos/admin — solo admin (config del negocio, no hay rol
// "staff" acá). Mismo patrón que app/api/agenda/route.ts: GET trae el estado
// actual, PATCH aplica una acción. El clave heredado viaja por header o query,
// igual que en agenda.
export const runtime = "nodejs";

function claveFromRequest(req: Request): string | null {
  return req.headers.get("x-eventos-key") ?? new URL(req.url).searchParams.get("clave");
}

export async function GET(req: Request) {
  if (!clientConfig.modules.eventos) return Response.json({ error: "Módulo no habilitado" }, { status: 404 });
  const user = await currentAdminUser(claveFromRequest(req));
  if (!user) return Response.json({ error: "No autorizado" }, { status: 401 });

  const [reservasWhatsapp, events, stats, chats] = await Promise.all([
    getReservationNumber(),
    listEvents(),
    derivationStats(30),
    // Últimos 7 días de conversación cruda (canal/pregunta/respuesta) — misma
    // fuente que ya alimenta el resumen diario, ver lib/chat-log.ts. Más
    // recientes primero para el panel.
    recentChats(24 * 7).then((list) => list.slice(-100).reverse()),
  ]);
  return Response.json({ reservasWhatsapp, events, stats, chats });
}

const patchSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("setReservationNumber"), phone: z.string().min(6).max(20) }),
  z.object({
    action: z.literal("upsertEvent"),
    id: z.string().optional(),
    venue: z.enum(["renaca", "vina"]),
    title: z.string().min(2).max(120),
    eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato de fecha inválido"),
    ticketUrl: z.string().url(),
  }),
  z.object({ action: z.literal("setEventActive"), id: z.string(), active: z.boolean() }),
]);

export async function PATCH(req: Request) {
  if (!clientConfig.modules.eventos) return Response.json({ error: "Módulo no habilitado" }, { status: 404 });
  const user = await currentAdminUser(claveFromRequest(req));
  if (!user) return Response.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Datos inválidos" }, { status: 400 });

  if (parsed.data.action === "setReservationNumber") {
    await setReservationNumber(parsed.data.phone);
  } else if (parsed.data.action === "upsertEvent") {
    await upsertEvent(parsed.data);
  } else {
    await setEventActive(parsed.data.id, parsed.data.active);
  }
  return Response.json({ ok: true });
}
