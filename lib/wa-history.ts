import { db, jsonb, withDb } from "@/lib/db";

// Memoria corta de conversación por número de WhatsApp, para que el asistente
// pueda completar flujos de varios mensajes (ej. agendar: servicio → hora →
// nombre).
//
// Con DATABASE_URL va a Postgres, y ahí importa: cada mensaje de WhatsApp puede
// caer en un isolate distinto, así que sin base de datos el asistente olvidaría
// lo conversado a mitad de camino. Sin DATABASE_URL queda en memoria (demos).

export interface WaTurn {
  role: "user" | "assistant";
  content: string;
}

interface WaThread {
  turns: WaTurn[];
  updatedAt: number;
}

const MAX_TURNS = 12; // ~6 idas y vueltas
const TTL_MS = 6 * 60 * 60 * 1000; // 6 horas: cubre la ventana de servicio típica

const g = globalThis as unknown as { __waHistory?: Map<string, WaThread> };

function threads(): Map<string, WaThread> {
  if (!g.__waHistory) g.__waHistory = new Map();
  return g.__waHistory;
}

export async function getHistory(phone: string): Promise<WaTurn[]> {
  return withDb(
    async () => {
      const sql = db();
      const rows = await sql`
        SELECT turns FROM wa_threads
        WHERE phone = ${phone} AND updated_at >= ${new Date(Date.now() - TTL_MS).toISOString()}
        LIMIT 1
      `;
      return ((rows[0]?.turns as WaTurn[]) ?? []).slice(-MAX_TURNS);
    },
    () => {
      const t = threads().get(phone);
      if (!t) return [];
      if (Date.now() - t.updatedAt > TTL_MS) {
        threads().delete(phone);
        return [];
      }
      return t.turns;
    }
  );
}

export async function appendHistory(phone: string, ...turns: WaTurn[]): Promise<void> {
  await withDb(
    async () => {
      const previos = await getHistory(phone);
      const siguientes = [...previos, ...turns].slice(-MAX_TURNS);
      const sql = db();
      await sql`
        INSERT INTO wa_threads (phone, turns, updated_at) VALUES (${phone}, ${jsonb(siguientes)}, now())
        ON CONFLICT (phone) DO UPDATE SET turns = EXCLUDED.turns, updated_at = now()
      `;
    },
    () => appendInMemory(phone, ...turns)
  );
}

function appendInMemory(phone: string, ...turns: WaTurn[]): void {
  const map = threads();
  const t = map.get(phone) ?? { turns: [], updatedAt: 0 };
  t.turns.push(...turns);
  if (t.turns.length > MAX_TURNS) t.turns.splice(0, t.turns.length - MAX_TURNS);
  t.updatedAt = Date.now();
  map.set(phone, t);
  // Limpieza básica para que el map no crezca sin límite.
  if (map.size > 500) {
    const oldest = [...map.entries()].sort((a, b) => a[1].updatedAt - b[1].updatedAt)[0];
    if (oldest) map.delete(oldest[0]);
  }
}
