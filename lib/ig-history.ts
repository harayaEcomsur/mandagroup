import { db, jsonb, withDb } from "@/lib/db";

// Memoria corta de conversación por IGSID (id de la persona en Instagram
// Direct), mismo patrón que lib/wa-history.ts — permite completar flujos de
// varios mensajes (ej. agendar: servicio → hora → nombre).
//
// Con DATABASE_URL va a Postgres (necesario: cada mensaje puede caer en un
// isolate distinto). Sin DATABASE_URL queda en memoria (demos).

export interface IgTurn {
  role: "user" | "assistant";
  content: string;
}

interface IgThread {
  turns: IgTurn[];
  updatedAt: number;
}

const MAX_TURNS = 12; // ~6 idas y vueltas
const TTL_MS = 6 * 60 * 60 * 1000; // 6 horas: cubre la ventana de servicio típica

const g = globalThis as unknown as { __igHistory?: Map<string, IgThread> };

function threads(): Map<string, IgThread> {
  if (!g.__igHistory) g.__igHistory = new Map();
  return g.__igHistory;
}

export async function getHistory(senderId: string): Promise<IgTurn[]> {
  return withDb(
    async () => {
      const sql = db();
      const rows = await sql`
        SELECT turns FROM ig_threads
        WHERE sender_id = ${senderId} AND updated_at >= ${new Date(Date.now() - TTL_MS).toISOString()}
        LIMIT 1
      `;
      return ((rows[0]?.turns as IgTurn[]) ?? []).slice(-MAX_TURNS);
    },
    () => {
      const t = threads().get(senderId);
      if (!t) return [];
      if (Date.now() - t.updatedAt > TTL_MS) {
        threads().delete(senderId);
        return [];
      }
      return t.turns;
    }
  );
}

export async function appendHistory(senderId: string, ...turns: IgTurn[]): Promise<void> {
  await withDb(
    async () => {
      const previos = await getHistory(senderId);
      const siguientes = [...previos, ...turns].slice(-MAX_TURNS);
      const sql = db();
      await sql`
        INSERT INTO ig_threads (sender_id, turns, updated_at) VALUES (${senderId}, ${jsonb(siguientes)}, now())
        ON CONFLICT (sender_id) DO UPDATE SET turns = EXCLUDED.turns, updated_at = now()
      `;
    },
    () => appendInMemory(senderId, ...turns)
  );
}

function appendInMemory(senderId: string, ...turns: IgTurn[]): void {
  const map = threads();
  const t = map.get(senderId) ?? { turns: [], updatedAt: 0 };
  t.turns.push(...turns);
  if (t.turns.length > MAX_TURNS) t.turns.splice(0, t.turns.length - MAX_TURNS);
  t.updatedAt = Date.now();
  map.set(senderId, t);
  // Limpieza básica para que el map no crezca sin límite.
  if (map.size > 500) {
    const oldest = [...map.entries()].sort((a, b) => a[1].updatedAt - b[1].updatedAt)[0];
    if (oldest) map.delete(oldest[0]);
  }
}
