import { db, hasDb, withDb } from "@/lib/db";

// Registro de interacciones del asistente IA (chat web, WhatsApp e Instagram)
// para armar el resumen diario al dueño.
//
// Con DATABASE_URL va a Postgres, y ahí importa de verdad: el cron del resumen
// corre en otro isolate que el que atendió las conversaciones, así que sin base
// de datos no vería nada. Sin DATABASE_URL queda en memoria (demos). Ver lib/db.ts.

export interface ChatLogEntry {
  ts: number;
  canal: "web" | "whatsapp" | "instagram";
  userText: string;
  assistantText: string;
}

const MAX_ENTRIES = 600; // tope duro en memoria: descarta las más viejas

const g = globalThis as unknown as { __chatLog?: ChatLogEntry[] };

function log(): ChatLogEntry[] {
  if (!g.__chatLog) g.__chatLog = [];
  return g.__chatLog;
}

// No se espera (ni se corta la respuesta al cliente) por guardar el registro:
// si falla, se pierde una línea del resumen, no la conversación.
export function logChat(entry: Omit<ChatLogEntry, "ts">): void {
  const l = log();
  l.push({ ...entry, ts: Date.now() });
  if (l.length > MAX_ENTRIES) l.splice(0, l.length - MAX_ENTRIES);

  if (!hasDb()) return;
  void withDb(
    async () => {
      const sql = db();
      await sql`
        INSERT INTO chat_log (canal, user_text, assistant_text)
        VALUES (${entry.canal}, ${entry.userText}, ${entry.assistantText})
      `;
    },
    () => undefined
  );
}

// Interacciones de las últimas `hours` horas, de la más antigua a la más nueva.
export async function recentChats(hours = 24): Promise<ChatLogEntry[]> {
  const since = Date.now() - hours * 60 * 60 * 1000;
  return withDb(
    async () => {
      const sql = db();
      const rows = await sql`
        SELECT canal, user_text, assistant_text, created_at
        FROM chat_log
        WHERE created_at >= ${new Date(since).toISOString()}
        ORDER BY created_at
        LIMIT ${MAX_ENTRIES}
      `;
      return rows.map((r) => ({
        ts: new Date(r.created_at as string).getTime(),
        canal: r.canal as ChatLogEntry["canal"],
        userText: String(r.user_text),
        assistantText: String(r.assistant_text),
      }));
    },
    () => log().filter((e) => e.ts >= since)
  );
}

// Higiene: el resumen solo mira 24h, así que las conversaciones viejas no sirven
// y no queremos guardar historial de clientes para siempre.
export async function purgeOldChats(days = 7): Promise<void> {
  if (!hasDb()) return;
  await withDb(
    async () => {
      const sql = db();
      const limite = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
      await sql`DELETE FROM chat_log WHERE created_at < ${limite}`;
    },
    () => undefined
  );
}
