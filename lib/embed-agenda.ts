import { db, ensureSchema, hasDb, withDb } from "@/lib/db";
import type { EmbedTenant } from "@/config/embed-tenants";

// Motor de agenda del asistente EMBEBIBLE, SCOPED POR TENANT.
//
// Aislado a propósito del booking-store single-tenant (lib/booking-store.ts, que
// sirve las demos vivas con la tabla `bookings` e índice único global
// (date,time)): acá usamos una tabla PROPIA `embed_bookings` con columna
// tenant_id e índice único (tenant_id,date,time), creada por su propio
// ensureEmbedSchema —no tocamos db.ts ni el esquema single-tenant—.
//
// Con DATABASE_URL las reservas viven en Postgres (persisten entre isolates de
// Vercel y la base impide que dos personas tomen la misma hora del mismo tenant).
// Sin DATABASE_URL cae a memoria por tenant (globalThis): las demos del add-on
// funcionan sin configurar base.

export type EmbedBookingStatus = "pendiente" | "confirmada" | "cancelada";

export interface EmbedBooking {
  id: string;
  service: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  name: string;
  phone: string;
  status: EmbedBookingStatus;
  createdAt: string;
}

const g = globalThis as unknown as { __embedBookings?: Map<string, EmbedBooking[]> };

function bucket(tenantId: string): EmbedBooking[] {
  if (!g.__embedBookings) g.__embedBookings = new Map();
  let arr = g.__embedBookings.get(tenantId);
  if (!arr) {
    arr = [];
    g.__embedBookings.set(tenantId, arr);
  }
  return arr;
}

// Esquema propio del embed, colocado con su store. Idempotente y cacheado por
// isolate. Reusa ensureSchema() para no competir con la creación de las tablas
// single-tenant, y luego agrega solo la suya.
let embedSchemaReady: Promise<void> | null = null;
function ensureEmbedSchema(): Promise<void> {
  if (!embedSchemaReady) {
    embedSchemaReady = (async () => {
      await ensureSchema();
      const sql = db();
      await sql`
        CREATE TABLE IF NOT EXISTS embed_bookings (
          id TEXT PRIMARY KEY,
          tenant_id TEXT NOT NULL,
          service TEXT NOT NULL,
          date TEXT NOT NULL,
          time TEXT NOT NULL,
          name TEXT NOT NULL,
          phone TEXT NOT NULL,
          status TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `;
      await sql`CREATE INDEX IF NOT EXISTS embed_bookings_tenant_date_idx ON embed_bookings (tenant_id, date)`;
      // La unicidad es POR TENANT: la misma hora puede estar tomada en dos
      // negocios distintos, pero no dos veces en el mismo.
      await sql`
        CREATE UNIQUE INDEX IF NOT EXISTS embed_bookings_slot_unico
        ON embed_bookings (tenant_id, date, time) WHERE status <> 'cancelada'
      `;
    })().catch((error) => {
      embedSchemaReady = null;
      throw error;
    });
  }
  return embedSchemaReady;
}

const DAY_NAMES_NORM = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];

function normalizeDay(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

// ¿El día `dayIdx` (0=domingo) calza con "Lunes a viernes", "Martes a sábado",
// "Viernes a lunes" (cruce de semana) o "Jueves"? Misma semántica que el
// booking-store single-tenant, en versión compacta.
function dayMatchesLabel(dayIdx: number, label: string): boolean {
  const l = normalizeDay(label);
  const range = l.match(/([a-z]+)\s+a\s+([a-z]+)/);
  if (range) {
    const from = DAY_NAMES_NORM.indexOf(range[1]);
    const to = DAY_NAMES_NORM.indexOf(range[2]);
    if (from >= 0 && to >= 0) {
      return from <= to ? dayIdx >= from && dayIdx <= to : dayIdx >= from || dayIdx <= to;
    }
  }
  return l.includes(DAY_NAMES_NORM[dayIdx]);
}

function hoursForDate(t: EmbedTenant, date: string): { open: string; close: string } | null {
  const dayIdx = new Date(date + "T12:00:00").getDay();
  for (const h of t.agenda?.hours ?? []) {
    if (dayMatchesLabel(dayIdx, h.day)) {
      if (h.closed || !h.open || !h.close) return null;
      return { open: h.open, close: h.close };
    }
  }
  return null;
}

// Construye la grilla del día a partir del horario del tenant y marca qué horas
// siguen libres según los `taken`. Pura: la comparten los caminos de base y memoria.
function buildSlots(t: EmbedTenant, date: string, taken: Set<string>): { time: string; available: boolean }[] {
  const hours = hoursForDate(t, date);
  if (!hours) return [];
  const slotMinutes = t.agenda?.slotMinutes ?? 60;
  const [oh, om] = hours.open.split(":").map(Number);
  const [ch, cm] = hours.close.split(":").map(Number);
  const slots: { time: string; available: boolean }[] = [];
  for (let m = oh * 60 + om; m + slotMinutes <= ch * 60 + cm; m += slotMinutes) {
    const time = `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
    slots.push({ time, available: !taken.has(time) });
  }
  return slots;
}

// Única fuente de verdad de disponibilidad del tenant: la usan la consulta y la
// creación de la reserva. Con base consulta `embed_bookings`; sin base, memoria.
export async function slotsForDate(t: EmbedTenant, date: string): Promise<{ time: string; available: boolean }[]> {
  return withDb(
    async () => {
      await ensureEmbedSchema();
      const sql = db();
      const rows = await sql`
        SELECT time FROM embed_bookings
        WHERE tenant_id = ${t.id} AND date = ${date} AND status <> 'cancelada'
      `;
      return buildSlots(t, date, new Set(rows.map((r) => String(r.time))));
    },
    () =>
      buildSlots(
        t,
        date,
        new Set(bucket(t.id).filter((b) => b.date === date && b.status !== "cancelada").map((b) => b.time))
      )
  );
}

function rowToBooking(r: Record<string, unknown>): EmbedBooking {
  return {
    id: String(r.id),
    service: String(r.service),
    date: String(r.date),
    time: String(r.time),
    name: String(r.name),
    phone: String(r.phone),
    status: r.status as EmbedBooking["status"],
    createdAt: new Date(r.created_at as string).toISOString(),
  };
}

// Todas las reservas del tenant (para su panel). Ordenadas por fecha y hora.
export async function listBookings(t: EmbedTenant): Promise<EmbedBooking[]> {
  return withDb(
    async () => {
      await ensureEmbedSchema();
      const sql = db();
      const rows = await sql`
        SELECT * FROM embed_bookings WHERE tenant_id = ${t.id} ORDER BY date, time
      `;
      return rows.map((r) => rowToBooking(r as Record<string, unknown>));
    },
    () => [...bucket(t.id)].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
  );
}

export async function setBookingStatus(
  tenantId: string,
  id: string,
  status: EmbedBookingStatus
): Promise<boolean> {
  return withDb(
    async () => {
      await ensureEmbedSchema();
      const sql = db();
      const rows = await sql`
        UPDATE embed_bookings SET status = ${status}
        WHERE tenant_id = ${tenantId} AND id = ${id} RETURNING id
      `;
      return rows.length > 0;
    },
    () => {
      const b = bucket(tenantId).find((x) => x.id === id);
      if (!b) return false;
      b.status = status;
      return true;
    }
  );
}

export async function createBooking(
  t: EmbedTenant,
  data: { service: string; date: string; time: string; name: string; phone: string }
): Promise<EmbedBooking | { error: string }> {
  const slot = (await slotsForDate(t, data.date)).find((s) => s.time === data.time);
  if (!slot) return { error: "Ese día no hay atención." };
  if (!slot.available) return { error: "Esa hora ya está tomada — elige otra." };

  const booking: EmbedBooking = {
    ...data,
    id: Math.random().toString(36).slice(2, 8).toUpperCase(),
    status: "pendiente",
    createdAt: new Date().toISOString(),
  };

  if (!hasDb()) {
    bucket(t.id).push(booking);
    return booking;
  }

  // Con base NO usamos withDb (que degradaría a memoria en silencio y ocultaría
  // el choque de horario): el índice único es la última defensa contra dos
  // reservas simultáneas del mismo slot en el mismo tenant.
  try {
    await ensureEmbedSchema();
    const sql = db();
    await sql`
      INSERT INTO embed_bookings (id, tenant_id, service, date, time, name, phone, status, created_at)
      VALUES (${booking.id}, ${t.id}, ${booking.service}, ${booking.date}, ${booking.time},
              ${booking.name}, ${booking.phone}, ${booking.status}, ${booking.createdAt})
    `;
    return booking;
  } catch (error) {
    if (String(error).includes("embed_bookings_slot_unico")) {
      return { error: "Esa hora acaba de tomarla otra persona — elige otra." };
    }
    console.error("[embed-agenda] createBooking:", error);
    return { error: "No pudimos registrar la reserva. Intenta de nuevo en unos minutos." };
  }
}
