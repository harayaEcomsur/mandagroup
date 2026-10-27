import { db, hasDb, withDb } from "@/lib/db";

// Bandeja de Instagram: cada mensaje que llega a una cuenta conectada y qué
// hizo el asistente con él (respondió, o por qué no). Los logs de Vercel duran
// 1 hora en el plan actual; esto queda en la base para revisar días después
// desde /eventos/admin ("¿por qué no le respondió a fulano?").
//
// Guarda texto de clientes: se borra solo a los 30 días (lib/privacy-store.ts).

export type IgOutcome =
  | "respondido"
  | "pausado" // alguien del equipo está atendiendo ese chat (pausa por toma de control)
  | "cuenta_desactivada" // asistente apagado para esa cuenta en el panel
  | "adjunto" // audio, foto, reel o sticker: el asistente solo lee texto
  | "historia" // respuesta o mención a una historia
  | "sin_respuesta_modelo" // la IA no devolvió texto
  | "error_envio" // Meta rechazó el envío (token, permisos, ventana de 24 h…)
  | "error" // falla inesperada
  | "equipo_respondio"; // una persona del equipo escribió a mano en el chat

export interface IgLogEntry {
  id: number;
  createdAt: string;
  accountId: string | null;
  senderId: string | null;
  senderName: string | null;
  text: string | null;
  outcome: IgOutcome;
  detail: string | null;
}

const MEM_MAX = 500;
const g = globalThis as unknown as { __igInboxLog?: IgLogEntry[] };
const mem = () => (g.__igInboxLog ??= []);

const cut = (s: string | null | undefined, n: number) => (s ? s.slice(0, n) : null);

// Se espera (el webhook ya respondió a Meta solo al final), pero nunca rompe
// el flujo: si falla el registro, se pierde la línea, no la respuesta.
export async function logIgEvent(e: Omit<IgLogEntry, "id" | "createdAt">): Promise<void> {
  const row = {
    accountId: e.accountId,
    senderId: e.senderId,
    senderName: cut(e.senderName, 120),
    text: cut(e.text, 500),
    outcome: e.outcome,
    detail: cut(e.detail, 500),
  };
  if (!hasDb()) {
    const l = mem();
    l.push({ ...row, id: l.length + 1, createdAt: new Date().toISOString() });
    if (l.length > MEM_MAX) l.splice(0, l.length - MEM_MAX);
    return;
  }
  try {
    await withDb(
      async () => {
        const sql = db();
        await sql`
          INSERT INTO ig_inbox_log (account_id, sender_id, sender_name, text, outcome, detail)
          VALUES (${row.accountId}, ${row.senderId}, ${row.senderName}, ${row.text}, ${row.outcome}, ${row.detail})
        `;
      },
      () => undefined
    );
  } catch (error) {
    console.warn("[ig-inbox-log] no se pudo guardar", error);
  }
}

export async function listIgEvents(days = 30, limit = 500): Promise<IgLogEntry[]> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  return withDb(
    async () => {
      const sql = db();
      const rows = await sql`
        SELECT id, created_at, account_id, sender_id, sender_name, text, outcome, detail
        FROM ig_inbox_log
        WHERE created_at >= ${since}
        ORDER BY created_at DESC
        LIMIT ${limit}
      `;
      return rows.map((r) => ({
        id: Number(r.id),
        createdAt: new Date(r.created_at as string).toISOString(),
        accountId: (r.account_id as string | null) ?? null,
        senderId: (r.sender_id as string | null) ?? null,
        senderName: (r.sender_name as string | null) ?? null,
        text: (r.text as string | null) ?? null,
        outcome: r.outcome as IgOutcome,
        detail: (r.detail as string | null) ?? null,
      }));
    },
    () => [...mem()].filter((e) => e.createdAt >= since).reverse().slice(0, limit)
  );
}
