import { db, jsonb, withDb } from "@/lib/db";

// Almacén de pedidos del módulo tienda.
//
// Con DATABASE_URL (Neon) los pedidos se guardan en Postgres — un pedido pagado
// no puede perderse. Sin DATABASE_URL vive en memoria (globalThis), suficiente
// para demos. Ver lib/db.ts. La página de confirmación además lee los datos del
// pago desde la URL de retorno, así que no depende solo de este almacén.

export interface OrderItem {
  slug: string;
  name: string;
  price: number; // CLP unitario
  qty: number;
}

export interface Order {
  id: string;
  items: OrderItem[];
  total: number;
  buyer: { name: string; email: string; phone: string; address?: string; note?: string };
  status: "pendiente_pago" | "pagada" | "rechazada" | "anulada";
  authorizationCode?: string;
  cardLast4?: string;
  createdAt: string;
}

const g = globalThis as unknown as { __orderStore?: { orders: Order[] } };

function store(): { orders: Order[] } {
  if (!g.__orderStore) g.__orderStore = { orders: [] };
  return g.__orderStore;
}

function rowToOrder(r: Record<string, unknown>): Order {
  return {
    id: String(r.id),
    items: (r.items as OrderItem[]) ?? [],
    total: Number(r.total),
    buyer: r.buyer as Order["buyer"],
    status: r.status as Order["status"],
    authorizationCode: (r.authorization_code as string | null) ?? undefined,
    cardLast4: (r.card_last4 as string | null) ?? undefined,
    createdAt: new Date(r.created_at as string).toISOString(),
  };
}

export async function createOrder(data: Pick<Order, "items" | "total" | "buyer">): Promise<Order> {
  const order: Order = {
    ...data,
    // Alfanumérico corto: Webpay exige buy_order de máx. 26 caracteres.
    id: "P" + Math.random().toString(36).slice(2, 8).toUpperCase(),
    status: "pendiente_pago",
    createdAt: new Date().toISOString(),
  };

  return withDb(
    async () => {
      const sql = db();
      await sql`
        INSERT INTO orders (id, items, total, buyer, status, created_at)
        VALUES (${order.id}, ${jsonb(order.items)}, ${order.total},
                ${jsonb(order.buyer)}, ${order.status}, ${order.createdAt})
      `;
      return order;
    },
    () => {
      store().orders.push(order);
      return order;
    }
  );
}

export async function getOrder(id: string): Promise<Order | undefined> {
  return withDb(
    async () => {
      const sql = db();
      const rows = await sql`SELECT * FROM orders WHERE id = ${id} LIMIT 1`;
      return rows[0] ? rowToOrder(rows[0] as Record<string, unknown>) : undefined;
    },
    () => store().orders.find((o) => o.id === id)
  );
}

export async function setOrderResult(
  id: string,
  status: Order["status"],
  detail?: { authorizationCode?: string; cardLast4?: string }
): Promise<void> {
  await withDb(
    async () => {
      const sql = db();
      await sql`
        UPDATE orders SET
          status = ${status},
          authorization_code = COALESCE(${detail?.authorizationCode ?? null}, authorization_code),
          card_last4 = COALESCE(${detail?.cardLast4 ?? null}, card_last4)
        WHERE id = ${id}
      `;
    },
    () => {
      const o = store().orders.find((x) => x.id === id);
      if (!o) return;
      o.status = status;
      if (detail?.authorizationCode) o.authorizationCode = detail.authorizationCode;
      if (detail?.cardLast4) o.cardLast4 = detail.cardLast4;
    }
  );
}

export async function listOrders(): Promise<Order[]> {
  return withDb(
    async () => {
      const sql = db();
      const rows = await sql`SELECT * FROM orders ORDER BY created_at DESC`;
      return rows.map((r) => rowToOrder(r as Record<string, unknown>));
    },
    () => [...store().orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  );
}
