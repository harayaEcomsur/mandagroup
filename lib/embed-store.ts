import { db, hasDb, jsonb, withDb } from "@/lib/db";
import type { EmbedTenant } from "@/config/embed-tenants";

// Pedidos del asistente EMBEBIBLE, SCOPED POR TENANT. Tabla propia embed_orders
// (con tenant_id), aislada del order-store single-tenant. Con DATABASE_URL
// persiste en Postgres; sin ella, memoria por tenant (demos sin base).
//
// Los precios y el total se resuelven SIEMPRE en el servidor desde el catálogo
// del tenant (config), nunca desde lo que diga el modelo.

export interface EmbedOrderItem {
  slug: string;
  name: string;
  price: number;
  qty: number;
}
export interface EmbedOrder {
  id: string;
  tenantId: string;
  items: EmbedOrderItem[];
  total: number;
  buyer: { name: string; phone: string; email?: string };
  status: "pendiente" | "pagado" | "rechazado" | "entregado";
  authorizationCode?: string;
  createdAt: string;
}

const g = globalThis as unknown as { __embedOrders?: Map<string, EmbedOrder[]> };
function bucket(tenantId: string): EmbedOrder[] {
  if (!g.__embedOrders) g.__embedOrders = new Map();
  let arr = g.__embedOrders.get(tenantId);
  if (!arr) {
    arr = [];
    g.__embedOrders.set(tenantId, arr);
  }
  return arr;
}

let embedOrdersSchemaReady: Promise<void> | null = null;
function ensureEmbedOrdersSchema(): Promise<void> {
  if (!embedOrdersSchemaReady) {
    embedOrdersSchemaReady = (async () => {
      const sql = db();
      await sql`
        CREATE TABLE IF NOT EXISTS embed_orders (
          id TEXT PRIMARY KEY,
          tenant_id TEXT NOT NULL,
          items JSONB NOT NULL,
          total INTEGER NOT NULL,
          buyer JSONB NOT NULL,
          status TEXT NOT NULL,
          authorization_code TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `;
      await sql`CREATE INDEX IF NOT EXISTS embed_orders_tenant_idx ON embed_orders (tenant_id, created_at DESC)`;
    })().catch((error) => {
      embedOrdersSchemaReady = null;
      throw error;
    });
  }
  return embedOrdersSchemaReady;
}

function rowToOrder(r: Record<string, unknown>): EmbedOrder {
  return {
    id: String(r.id),
    tenantId: String(r.tenant_id),
    items: r.items as EmbedOrderItem[],
    total: Number(r.total),
    buyer: r.buyer as EmbedOrder["buyer"],
    status: r.status as EmbedOrder["status"],
    authorizationCode: (r.authorization_code as string) ?? undefined,
    createdAt: new Date(r.created_at as string).toISOString(),
  };
}

// El total se calcula acá con `resolved` (precios del servidor); el llamador
// nunca pasa un total propio.
export async function createOrder(
  tenant: EmbedTenant,
  data: { items: EmbedOrderItem[]; buyer: EmbedOrder["buyer"] }
): Promise<EmbedOrder> {
  const total = data.items.reduce((n, i) => n + i.price * i.qty, 0);
  const order: EmbedOrder = {
    id: "P" + Math.random().toString(36).slice(2, 8).toUpperCase(),
    tenantId: tenant.id,
    items: data.items,
    total,
    buyer: data.buyer,
    status: "pendiente",
    createdAt: new Date().toISOString(),
  };
  if (!hasDb()) {
    bucket(tenant.id).push(order);
    return order;
  }
  await withDb(
    async () => {
      await ensureEmbedOrdersSchema();
      const sql = db();
      await sql`
        INSERT INTO embed_orders (id, tenant_id, items, total, buyer, status, created_at)
        VALUES (${order.id}, ${order.tenantId}, ${jsonb(order.items)}, ${order.total},
                ${jsonb(order.buyer)}, ${order.status}, ${order.createdAt})
      `;
    },
    () => {
      bucket(tenant.id).push(order);
    }
  );
  return order;
}

// Todos los pedidos del tenant (para su panel), más nuevos primero.
export async function listOrders(tenantId: string): Promise<EmbedOrder[]> {
  return withDb(
    async () => {
      await ensureEmbedOrdersSchema();
      const sql = db();
      const rows = await sql`SELECT * FROM embed_orders WHERE tenant_id = ${tenantId} ORDER BY created_at DESC`;
      return rows.map((r) => rowToOrder(r as Record<string, unknown>));
    },
    () => [...bucket(tenantId)].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  );
}

export async function getOrder(tenantId: string, id: string): Promise<EmbedOrder | undefined> {
  return withDb(
    async () => {
      await ensureEmbedOrdersSchema();
      const sql = db();
      const rows = await sql`SELECT * FROM embed_orders WHERE tenant_id = ${tenantId} AND id = ${id} LIMIT 1`;
      return rows[0] ? rowToOrder(rows[0] as Record<string, unknown>) : undefined;
    },
    () => bucket(tenantId).find((o) => o.id === id)
  );
}

export async function setOrderStatus(
  tenantId: string,
  id: string,
  status: EmbedOrder["status"],
  authorizationCode?: string
): Promise<boolean> {
  return withDb(
    async () => {
      await ensureEmbedOrdersSchema();
      const sql = db();
      const rows = await sql`
        UPDATE embed_orders SET status = ${status}, authorization_code = ${authorizationCode ?? null}
        WHERE tenant_id = ${tenantId} AND id = ${id} RETURNING id
      `;
      return rows.length > 0;
    },
    () => {
      const o = bucket(tenantId).find((x) => x.id === id);
      if (!o) return false;
      o.status = status;
      if (authorizationCode) o.authorizationCode = authorizationCode;
      return true;
    }
  );
}
