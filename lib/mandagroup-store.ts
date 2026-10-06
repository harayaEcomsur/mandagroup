import { db, jsonb, withDb } from "@/lib/db";
import { listVestiEvents, type VestiTicket } from "@/lib/vesti";

// Almacén del módulo "eventos" (discotecas/fiestas, requiere modules.eventos):
// número de WhatsApp al que se derivan las reservas y eventos activos con su
// link de venta de entradas — ambos editables desde /eventos/admin sin tocar
// código, y estadísticas de derivaciones (equivalente a lo que hoy se ve en
// ManyChat). Mismo patrón que lib/lead-store.ts y los settings de
// lib/booking-store.ts: con DATABASE_URL persiste en Postgres, sin ella vive
// en memoria (demos/desarrollo local).

export type Venue = "renaca" | "vina";
// Dónde ocurre un evento: los 2 locales, o una de las otras cuentas de Vesti
// del grupo — "costa" = fiestas Costa Nights (productora Costa Eventos, en
// recintos externos: Club Naval, Club Español…) y "standup" = Eventos & Stand
// Up (shows de humor y promociones como Cyber Days). Solo existen para eventos
// importados de Vesti; reservas, scopes de Instagram y eventos manuales siguen
// siendo de un local (Venue).
export type EventVenue = Venue | "costa" | "standup";
export type DerivationTipo = "reserva" | "invitacion";
export type Canal = "web" | "whatsapp" | "instagram";

export interface MandagroupEvent {
  id: string;
  venue: EventVenue;
  title: string;
  ticketUrl: string;
  eventDate: string; // "YYYY-MM-DD" — la fecha real del evento, no la de carga
  active: boolean;
  createdAt: string;
  // Solo en eventos importados de Vesti (ver lib/vesti.ts) — los cargados a
  // mano en /eventos/admin no los traen.
  source?: "manual" | "vesti";
  imageUrl?: string | null;
  lowestPrice?: number | null;
  startsAt?: string;
  // Detalle que trae Vesti (ver lib/vesti.ts): recinto ("Club Naval"),
  // dirección real, tipos de entrada, agotado/reprogramado.
  place?: string | null;
  endsAt?: string | null;
  lastDate?: string; // "YYYY-MM-DD" del último día (eventos de varios días)
  address?: string | null;
  comuna?: string | null;
  geo?: { lat: number; lng: number } | null;
  tickets?: VestiTicket[];
  soldOut?: boolean;
  rescheduled?: boolean;
}

// "YYYY-MM-DD" de hoy en hora de Chile — mismo truco que ya usa
// lib/assistant-prompt.ts para el módulo de agenda.
function todayCL(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago" }).format(new Date());
}

export interface Derivation {
  canal: Canal;
  tipo: DerivationTipo;
  venue?: EventVenue;
  eventId?: string;
  eventTitle?: string;
  userMessage?: string;
}

const RESERVAS_WHATSAPP_KEY = "mandagroup_reservas_whatsapp";
const INSTAGRAM_SCOPES_KEY = "mandagroup_instagram_scopes";
const HIDDEN_VESTI_KEY = "mandagroup_hidden_vesti_events";

// Qué puede ofrecer el asistente en una cuenta de Instagram puntual — sin
// scope guardado para esa cuenta (el caso por defecto), no hay restricción:
// ambos locales y reservas, igual que hoy. Editable desde /eventos/admin.
// `enabled: false` apaga el asistente del todo para esa cuenta (ni responde) —
// para cuando el equipo prefiere atenderla a mano por un tiempo.
export interface InstagramScope {
  enabled: boolean;
  venues: Venue[];
  allowReservations: boolean;
}

interface Store {
  reservasWhatsapp: string | null;
  events: MandagroupEvent[];
  derivations: (Derivation & { createdAt: string })[];
  instagramScopes: Record<string, InstagramScope>;
  hiddenVesti: string[];
}

const g = globalThis as unknown as { __mandagroupStore?: Store };

function store(): Store {
  if (!g.__mandagroupStore) {
    g.__mandagroupStore = { reservasWhatsapp: null, events: [], derivations: [], instagramScopes: {}, hiddenVesti: [] };
  }
  return g.__mandagroupStore;
}

function rowToEvent(r: Record<string, unknown>): MandagroupEvent {
  return {
    id: String(r.id),
    venue: r.venue as Venue,
    title: String(r.title),
    ticketUrl: String(r.ticket_url),
    eventDate: String(r.event_date),
    active: Boolean(r.active),
    createdAt: new Date(r.created_at as string).toISOString(),
  };
}

// --- Número de WhatsApp de reservas (editable, sin redeploy) ---

export async function getReservationNumber(): Promise<string | null> {
  return withDb(
    async () => {
      const sql = db();
      const rows = await sql`SELECT value FROM settings WHERE key = ${RESERVAS_WHATSAPP_KEY} LIMIT 1`;
      return (rows[0]?.value as { phone: string } | undefined)?.phone ?? null;
    },
    () => store().reservasWhatsapp
  );
}

export async function setReservationNumber(phone: string): Promise<void> {
  await withDb(
    async () => {
      const sql = db();
      await sql`
        INSERT INTO settings (key, value) VALUES (${RESERVAS_WHATSAPP_KEY}, ${jsonb({ phone })})
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
      `;
    },
    () => {
      store().reservasWhatsapp = phone;
    }
  );
}

// --- Alcance por cuenta de Instagram (qué local(es) y si ofrece reservas) ---
// Un solo row en `settings` con un mapa {igAccountId: scope} — hay a lo más un
// puñado de cuentas de Instagram, no justifica una tabla propia.

export async function getInstagramScopes(): Promise<Record<string, InstagramScope>> {
  return withDb(
    async () => {
      const sql = db();
      const rows = await sql`SELECT value FROM settings WHERE key = ${INSTAGRAM_SCOPES_KEY} LIMIT 1`;
      return (rows[0]?.value as Record<string, InstagramScope> | undefined) ?? {};
    },
    () => store().instagramScopes
  );
}

// `undefined`/sin entry significa sin restricción (ambos locales + reservas) —
// el comportamiento de siempre para cualquier cuenta que no se haya tocado.
export async function getInstagramScope(igAccountId: string | undefined): Promise<InstagramScope | undefined> {
  if (!igAccountId) return undefined;
  const scopes = await getInstagramScopes();
  return scopes[igAccountId];
}

export async function setInstagramScope(igAccountId: string, scope: InstagramScope): Promise<void> {
  const current = await getInstagramScopes();
  const next = { ...current, [igAccountId]: scope };
  await withDb(
    async () => {
      const sql = db();
      await sql`
        INSERT INTO settings (key, value) VALUES (${INSTAGRAM_SCOPES_KEY}, ${jsonb(next)})
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
      `;
    },
    () => {
      store().instagramScopes = next;
    }
  );
}

// --- Eventos activos (link de entradas por evento, distinto viernes/sábado) ---

// Todos los eventos (pasados, futuros, activos e inactivos) — vista del panel,
// ordenados por fecha del evento (no por cuándo se cargaron).
export async function listEvents(): Promise<MandagroupEvent[]> {
  return withDb(
    async () => {
      const sql = db();
      const rows = await sql`SELECT * FROM mandagroup_events ORDER BY event_date ASC`;
      return rows.map((r) => rowToEvent(r as Record<string, unknown>));
    },
    () => [...store().events].sort((a, b) => a.eventDate.localeCompare(b.eventDate))
  );
}

// Lo que el asistente puede ofrecer: activos Y con fecha hoy o futura — un
// evento de ayer deja de aparecer solo, sin depender de que alguien lo
// desactive a mano. Ya viene ordenado con el más próximo primero (ver
// listEvents), así "el primero de la lista" siempre es la próxima fiesta.
//
// Además de los cargados a mano, suma los próximos eventos publicados en
// Vesti (salvo los que se ocultaron desde el panel). Si un evento manual ya
// apunta al mismo link de Vesti, gana el manual (puede traer un título más
// limpio) y el importado no se duplica.
export async function listActiveEvents(): Promise<MandagroupEvent[]> {
  const today = todayCL();
  const [manual, vesti, hidden] = await Promise.all([listEvents(), listVestiEvents(), getHiddenVestiIds()]);
  const active = manual.filter((e) => e.active && e.eventDate >= today).map((e) => ({ ...e, source: "manual" as const }));
  const manualUrls = new Set(active.map((e) => e.ticketUrl.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")));
  const imported: MandagroupEvent[] = vesti
    // Visible hasta que TERMINA (no hasta que empieza): una promoción de
    // varios días, como Cyber Days, sigue en la cartelera mientras dure.
    .filter((v) => v.lastDate >= today && !hidden.includes(v.vestiId))
    .filter((v) => !manualUrls.has(v.url.replace(/^https?:\/\/(www\.)?/, "")))
    .map((v) => ({
      id: `vesti:${v.vestiId}`,
      venue: v.venue,
      title: v.name,
      ticketUrl: v.url,
      eventDate: v.eventDate,
      active: true,
      createdAt: v.startsAt,
      source: "vesti",
      imageUrl: v.imageUrl,
      lowestPrice: v.lowestPrice,
      startsAt: v.startsAt,
      place: v.place,
      endsAt: v.endsAt,
      lastDate: v.lastDate,
      address: v.address,
      comuna: v.comuna,
      geo: v.geo,
      tickets: v.tickets,
      soldOut: v.soldOut,
      rescheduled: v.rescheduled,
    }));
  return [...active, ...imported].sort(
    (a, b) => a.eventDate.localeCompare(b.eventDate) || (a.startsAt ?? "").localeCompare(b.startsAt ?? "")
  );
}

// --- Eventos de Vesti ocultos (el resto se publica solo) ---

export async function getHiddenVestiIds(): Promise<string[]> {
  return withDb(
    async () => {
      const sql = db();
      const rows = await sql`SELECT value FROM settings WHERE key = ${HIDDEN_VESTI_KEY} LIMIT 1`;
      return (rows[0]?.value as { ids: string[] } | undefined)?.ids ?? [];
    },
    () => store().hiddenVesti
  );
}

export async function setVestiHidden(vestiId: string, hidden: boolean): Promise<void> {
  const current = await getHiddenVestiIds();
  const next = hidden ? Array.from(new Set([...current, vestiId])) : current.filter((id) => id !== vestiId);
  await withDb(
    async () => {
      const sql = db();
      await sql`
        INSERT INTO settings (key, value) VALUES (${HIDDEN_VESTI_KEY}, ${jsonb({ ids: next })})
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
      `;
    },
    () => {
      store().hiddenVesti = next;
    }
  );
}

export async function upsertEvent(data: {
  id?: string;
  venue: Venue;
  title: string;
  ticketUrl: string;
  eventDate: string;
}): Promise<MandagroupEvent> {
  const event: MandagroupEvent = {
    id: data.id ?? Math.random().toString(36).slice(2, 8).toUpperCase(),
    venue: data.venue,
    title: data.title,
    ticketUrl: data.ticketUrl,
    eventDate: data.eventDate,
    active: true,
    createdAt: new Date().toISOString(),
  };

  return withDb(
    async () => {
      const sql = db();
      await sql`
        INSERT INTO mandagroup_events (id, venue, title, ticket_url, event_date, active, created_at)
        VALUES (${event.id}, ${event.venue}, ${event.title}, ${event.ticketUrl}, ${event.eventDate}, true, ${event.createdAt})
        ON CONFLICT (id) DO UPDATE SET
          venue = EXCLUDED.venue, title = EXCLUDED.title, ticket_url = EXCLUDED.ticket_url, event_date = EXCLUDED.event_date
      `;
      return event;
    },
    () => {
      const list = store().events;
      const i = list.findIndex((e) => e.id === event.id);
      if (i >= 0) list[i] = { ...list[i], ...event };
      else list.push(event);
      return event;
    }
  );
}

export async function setEventActive(id: string, active: boolean): Promise<void> {
  await withDb(
    async () => {
      const sql = db();
      await sql`UPDATE mandagroup_events SET active = ${active} WHERE id = ${id}`;
    },
    () => {
      const event = store().events.find((e) => e.id === id);
      if (event) event.active = active;
    }
  );
}

// --- Derivaciones (para las estadísticas del panel) ---

export function logDerivation(entry: Derivation): void {
  const withTs = { ...entry, createdAt: new Date().toISOString() };
  store().derivations.push(withTs);
  if (store().derivations.length > 2000) store().derivations.shift();

  void withDb(
    async () => {
      const sql = db();
      await sql`
        INSERT INTO mandagroup_derivations (canal, tipo, venue, event_id, event_title, user_message)
        VALUES (${entry.canal}, ${entry.tipo}, ${entry.venue ?? null}, ${entry.eventId ?? null}, ${entry.eventTitle ?? null}, ${entry.userMessage ?? null})
      `;
    },
    () => undefined
  );
}

export interface DerivationStats {
  total: number;
  porTipo: Record<DerivationTipo, number>;
  porVenue: Partial<Record<EventVenue, number>>;
  porCanal: Record<Canal, number>;
  recientes: (Derivation & { createdAt: string })[];
}

export async function derivationStats(days = 30): Promise<DerivationStats> {
  const since = Date.now() - days * 24 * 60 * 60 * 1000;

  const rows = await withDb(
    async () => {
      const sql = db();
      const result = await sql`
        SELECT canal, tipo, venue, event_id, event_title, user_message, created_at
        FROM mandagroup_derivations
        WHERE created_at >= ${new Date(since).toISOString()}
        ORDER BY created_at DESC
        LIMIT 500
      `;
      return result.map((r) => ({
        canal: r.canal as Canal,
        tipo: r.tipo as DerivationTipo,
        venue: (r.venue as EventVenue | null) ?? undefined,
        eventId: (r.event_id as string | null) ?? undefined,
        eventTitle: (r.event_title as string | null) ?? undefined,
        userMessage: (r.user_message as string | null) ?? undefined,
        createdAt: new Date(r.created_at as string).toISOString(),
      }));
    },
    () => store().derivations.filter((d) => new Date(d.createdAt).getTime() >= since)
  );

  const stats: DerivationStats = {
    total: rows.length,
    porTipo: { reserva: 0, invitacion: 0 },
    porVenue: {},
    porCanal: { web: 0, whatsapp: 0, instagram: 0 },
    recientes: rows.slice(0, 50),
  };
  for (const r of rows) {
    stats.porTipo[r.tipo]++;
    stats.porCanal[r.canal]++;
    if (r.venue) stats.porVenue[r.venue] = (stats.porVenue[r.venue] ?? 0) + 1;
  }
  return stats;
}
