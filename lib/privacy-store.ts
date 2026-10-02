import { randomUUID } from "crypto";
import { db, ensureSchema, hasDb, withDb } from "@/lib/db";
import { retentionMonths, cutoffDate } from "@/lib/privacy";
import { purgeOldChats } from "@/lib/chat-log";

// Solicitudes de derechos ARCO+ (Ley 21.719) y purga de datos vencidos. Ver
// docs/registro-actividades-tratamiento.md para el detalle de qué tabla
// corresponde a qué finalidad, y docs/plan-respuesta-brechas.md para el
// procedimiento ante una brecha.

export interface PrivacyRequest {
  id: string;
  tipo: "acceso" | "rectificacion" | "cancelacion" | "oposicion" | "portabilidad" | "bloqueo";
  nombre: string;
  contacto: string;
  detalle?: string;
  estado: "pendiente" | "resuelta";
  plazoRespuesta: string;
  createdAt: string;
}

function rowToRequest(r: Record<string, unknown>): PrivacyRequest {
  return {
    id: String(r.id),
    tipo: r.tipo as PrivacyRequest["tipo"],
    nombre: String(r.nombre),
    contacto: String(r.contacto),
    detalle: (r.detalle as string) ?? undefined,
    estado: r.estado as PrivacyRequest["estado"],
    plazoRespuesta: new Date(r.plazo_respuesta as string).toISOString(),
    createdAt: new Date(r.created_at as string).toISOString(),
  };
}

const g = globalThis as unknown as { __privacyRequests?: PrivacyRequest[] };
function memStore(): PrivacyRequest[] {
  if (!g.__privacyRequests) g.__privacyRequests = [];
  return g.__privacyRequests;
}

// El plazo legal de respuesta a una solicitud ARCO+ es de 30 días — se calcula
// y guarda al crear la solicitud para poder auditar después si se contestó a
// tiempo, sin tener que recalcularlo cada vez.
export async function createPrivacyRequest(data: {
  tipo: PrivacyRequest["tipo"];
  nombre: string;
  contacto: string;
  detalle?: string;
}): Promise<PrivacyRequest> {
  const now = new Date();
  const plazo = new Date(now);
  plazo.setDate(plazo.getDate() + 30);
  const req: PrivacyRequest = {
    id: randomUUID(),
    ...data,
    estado: "pendiente",
    plazoRespuesta: plazo.toISOString(),
    createdAt: now.toISOString(),
  };
  await withDb(
    async () => {
      const sql = db();
      await sql`
        INSERT INTO privacy_requests (id, tipo, nombre, contacto, detalle, estado, plazo_respuesta, created_at)
        VALUES (${req.id}, ${req.tipo}, ${req.nombre}, ${req.contacto}, ${req.detalle ?? null}, 'pendiente', ${req.plazoRespuesta}, ${req.createdAt})
      `;
    },
    () => {
      memStore().push(req);
    }
  );
  return req;
}

export async function listPrivacyRequests(): Promise<PrivacyRequest[]> {
  return withDb(
    async () => {
      const sql = db();
      const rows = await sql`SELECT * FROM privacy_requests ORDER BY created_at DESC`;
      return rows.map(rowToRequest);
    },
    () => [...memStore()].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  );
}

export async function resolvePrivacyRequest(id: string): Promise<void> {
  await withDb(
    async () => {
      const sql = db();
      await sql`UPDATE privacy_requests SET estado = 'resuelta' WHERE id = ${id}`;
    },
    () => {
      const r = memStore().find((x) => x.id === id);
      if (r) r.estado = "resuelta";
    }
  );
}

// Borra datos más viejos que su plazo de retención (ver lib/privacy.ts).
// SOLO se llama desde /api/privacidad/purgar (Vercel Cron, una vez al día) —
// nunca desde el flujo normal de la app. Sin DATABASE_URL no hace nada: en
// memoria no tiene sentido "retener" nada entre invocaciones.
//
// re_clients y re_properties quedan afuera a propósito: la relación con un
// dueño/arrendatario puede ser plurianual (renovaciones, nuevas propiedades),
// borrarla sola por antigüedad destruiría una relación de negocio activa. Esa
// decisión la toma la administradora desde el panel, no un cron.
export async function purgeExpiredData(): Promise<Record<string, number>> {
  if (!hasDb()) return {};
  await ensureSchema();
  const sql = db();
  const results: Record<string, number> = {};

  // Tolerante a tabla inexistente (42P01): embed_orders/embed_bookings solo
  // existen si ese tenant alguna vez usó el asistente embebible con agenda o
  // tienda propia — un sitio que no los usa no debería hacer fallar la purga
  // completa por eso.
  const del = async (key: string, table: string, column: string, months: number) => {
    const cutoff = cutoffDate(months).toISOString();
    try {
      const r = await sql`DELETE FROM ${sql(table)} WHERE ${sql(column)} < ${cutoff}`;
      results[key] = r.count;
    } catch (error) {
      if ((error as { code?: string }).code === "42P01") {
        results[key] = 0;
      } else {
        throw error;
      }
    }
  };

  await del("bookings", "bookings", "created_at", retentionMonths("bookings"));
  await del("embed_bookings", "embed_bookings", "created_at", retentionMonths("bookings"));
  await del("leads", "leads", "created_at", retentionMonths("leads"));
  await del("wa_threads", "wa_threads", "updated_at", retentionMonths("waThreads"));
  await del("orders", "orders", "created_at", retentionMonths("orders"));
  await del("embed_orders", "embed_orders", "created_at", retentionMonths("orders"));
  await del("re_deliveries", "re_deliveries", "created_at", retentionMonths("realEstateDeliveries"));
  await del("re_contracts", "re_contracts", "created_at", retentionMonths("realEstateContracts"));

  // chat_log tiene su propia función (mismo criterio, reutilizada tal cual).
  const chatCutoffDays = retentionMonths("chatLogs") * 30;
  await purgeOldChats(chatCutoffDays);
  results.chat_log = -1; // purgeOldChats no devuelve conteo; -1 = "se ejecutó, sin conteo"

  return results;
}
