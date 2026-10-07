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
  getFeaturedEventIds,
  setEventFeatured,
} from "@/lib/mandagroup-store";
import { listVestiEvents } from "@/lib/vesti";
import { listCartas, listLocales, normalizeAlias, saveCartas, saveLocales } from "@/lib/mandagroup-catalog";
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

  const [reservasWhatsapp, events, stats, chats, instagramScopes, pausedThreads, vestiEvents, hiddenVesti, featuredIds, locales, cartas] = await Promise.all([
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
    getFeaturedEventIds(),
    listLocales(),
    listCartas(),
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
    // Ids destacados en el hero: id manual o "vesti:<vestiId>".
    featuredIds,
    // Locales con su canal de reservas, y cartas (archivo o link) con sus URLs de QR.
    locales,
    cartas,
  });
}

const brandSchema = z.enum(["manda", "carbon", "costa"]);

const localSchema = z.object({
  id: z.string().min(1).max(60),
  brand: brandSchema,
  name: z.string().min(2).max(80),
  address: z.string().max(160).optional(),
  mapsUrl: z.string().url().optional().or(z.literal("").transform(() => undefined)),
  reservation: z.discriminatedUnion("type", [
    z.object({ type: z.literal("whatsapp"), phone: z.string().regex(/^\d{8,15}$/, "WhatsApp: solo dígitos con código de país (569…)") }),
    z.object({ type: z.literal("instagram"), handle: z.string().regex(/^@?[\w.]{1,30}$/, "Instagram inválido") }),
    z.object({ type: z.literal("url"), url: z.string().url(), label: z.string().max(60).optional() }),
    z.object({ type: z.literal("none") }),
  ]),
  showOnSite: z.boolean(),
  order: z.number().int(),
});

// Rutas del sitio que una URL de QR no puede pisar.
const RESERVED = ["/", "/carta", "/carbon", "/api", "/eventos", "/privacidad", "/llms.txt", "/robots.txt", "/sitemap.xml"];

const cartaSchema = z.object({
  id: z.string().min(1).max(60),
  brand: brandSchema,
  title: z.string().min(2).max(100),
  description: z.string().max(200).optional(),
  source: z.discriminatedUnion("type", [
    z.object({
      type: z.literal("file"),
      url: z.string().min(1),
      sizeBytes: z.number().optional(),
      pages: z.array(z.object({ src: z.string(), width: z.number(), height: z.number() })).optional(),
    }),
    z.object({ type: z.literal("url"), url: z.string().url() }),
  ]),
  showOnSite: z.boolean(),
  onCarbonPage: z.boolean(),
  aliases: z.array(z.string().min(2).max(120)).max(10),
  order: z.number().int(),
  updatedAt: z.string(),
});

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
  z.object({ action: z.literal("setEventFeatured"), eventId: z.string().min(1), featured: z.boolean() }),
  z.object({ action: z.literal("saveLocales"), locales: z.array(localSchema).max(40) }),
  z.object({ action: z.literal("saveCartas"), cartas: z.array(cartaSchema).max(60) }),
]);

export async function PATCH(req: Request) {
  if (!clientConfig.modules.eventos) return Response.json({ error: "Módulo no habilitado" }, { status: 404 });
  const user = await currentAdminUser(claveFromRequest(req));
  if (!user) return Response.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return Response.json({ error: issue?.message && issue.message !== "Required" ? issue.message : "Datos inválidos" }, { status: 400 });
  }

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
  } else if (parsed.data.action === "saveLocales") {
    await saveLocales(parsed.data.locales);
  } else if (parsed.data.action === "saveCartas") {
    // Una URL de QR solo puede apuntar a una carta, y no puede pisar páginas del sitio.
    const seen = new Map<string, string>();
    for (const c of parsed.data.cartas) {
      for (const a of c.aliases) {
        const n = normalizeAlias(a);
        if (RESERVED.some((r) => n === r || n.startsWith(r + "/")) || n.split("/").length > 2) {
          return Response.json({ error: `La URL ${n} no se puede usar para un QR (es una página del sitio o tiene subcarpetas).` }, { status: 400 });
        }
        if (seen.has(n) && seen.get(n) !== c.id) {
          return Response.json({ error: `La URL ${n} está asignada a dos cartas.` }, { status: 400 });
        }
        seen.set(n, c.id);
      }
    }
    await saveCartas(parsed.data.cartas.map((c) => ({ ...c, aliases: c.aliases.map(normalizeAlias) })));
  } else if (parsed.data.action === "setEventFeatured") {
    await setEventFeatured(parsed.data.eventId, parsed.data.featured);
  } else {
    await resumeThread(parsed.data.senderId);
  }
  // La home muestra la cartelera: que un evento agregado/ocultado se vea ya,
  // sin esperar la regeneración de 5 min.
  if (["upsertEvent", "setEventActive", "setVestiHidden", "setEventFeatured", "saveLocales"].includes(parsed.data.action)) {
    revalidatePath("/");
  }
  if (["saveCartas", "saveLocales"].includes(parsed.data.action)) {
    revalidatePath("/carta");
    revalidatePath("/carbon");
    revalidatePath("/llms.txt");
  }
  return Response.json({ ok: true });
}
