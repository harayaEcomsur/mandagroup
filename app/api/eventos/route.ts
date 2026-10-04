import { z } from "zod";
import { revalidatePath } from "next/cache";
import { clientConfig } from "@/config/client.config";
import { currentAdminUser } from "@/lib/auth";
import {
  getReservationNumber,
  setReservationNumber,
  listEvents,
  upsertEvent,
  setEventActive,
  derivationStats,
  getInstagramScopes,
  setInstagramScope,
  getHiddenVestiIds,
  setVestiHidden,
} from "@/lib/mandagroup-store";
import { listVestiEvents } from "@/lib/vesti";
import { recentChats } from "@/lib/chat-log";
import { listPausedThreads, resumeThread } from "@/lib/ig-history";

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

  const [reservasWhatsapp, events, stats, chats, instagramScopes, pausedThreads, vestiEvents, hiddenVesti] = await Promise.all([
    getReservationNumber(),
    listEvents(),
    derivationStats(30),
    // Últimos 7 días de conversación cruda (canal/pregunta/respuesta) — misma
    // fuente que ya alimenta el resumen diario, ver lib/chat-log.ts. Más
    // recientes primero para el panel.
    recentChats(24 * 7).then((list) => list.slice(-100).reverse()),
    getInstagramScopes(),
    listPausedThreads(),
    listVestiEvents(),
    getHiddenVestiIds(),
  ]);
  return Response.json({
    reservasWhatsapp,
    events,
    stats,
    chats,
    instagramScopes,
    // Las cuentas vienen de config (fijas por cliente), no de la DB — el panel
    // necesita saber cuáles existen para poder ofrecer un scope por cada una.
    instagramAccounts: clientConfig.instagramAccounts ?? {},
    pausedThreads,
    // Próximos eventos publicados en Vesti — salen solos en el sitio y en el
    // asistente salvo los que estén en hiddenVesti.
    vestiEvents,
    hiddenVesti,
  });
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
  z.object({
    action: z.literal("setInstagramScope"),
    igAccountId: z.string().min(1),
    enabled: z.boolean(),
    venues: z.array(z.enum(["renaca", "vina"])).min(1),
    allowReservations: z.boolean(),
  }),
  z.object({ action: z.literal("resumeInstagramThread"), senderId: z.string().min(1) }),
  z.object({ action: z.literal("setVestiHidden"), vestiId: z.string().min(1), hidden: z.boolean() }),
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
  } else if (parsed.data.action === "setEventActive") {
    await setEventActive(parsed.data.id, parsed.data.active);
  } else if (parsed.data.action === "setInstagramScope") {
    await setInstagramScope(parsed.data.igAccountId, {
      enabled: parsed.data.enabled,
      venues: parsed.data.venues,
      allowReservations: parsed.data.allowReservations,
    });
  } else if (parsed.data.action === "setVestiHidden") {
    await setVestiHidden(parsed.data.vestiId, parsed.data.hidden);
  } else {
    await resumeThread(parsed.data.senderId);
  }
  // La home muestra la cartelera: que un evento agregado/ocultado se vea ya,
  // sin esperar la regeneración de 5 min.
  if (["upsertEvent", "setEventActive", "setVestiHidden"].includes(parsed.data.action)) revalidatePath("/");
  return Response.json({ ok: true });
}
