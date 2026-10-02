import { z } from "zod";
import { clientConfig } from "@/config/client.config";
import { createOrder } from "@/lib/order-store";
import { createTransaction } from "@/lib/webpay";

export const runtime = "nodejs";

const checkoutSchema = z.object({
  items: z
    .array(z.object({ slug: z.string(), qty: z.number().int().min(1).max(99) }))
    .min(1)
    .max(50),
  buyer: z.object({
    name: z.string().min(1).max(120),
    email: z.string().email(),
    phone: z.string().min(6).max(30),
    address: z.string().max(200).optional(),
    note: z.string().max(500).optional(),
  }),
});

export async function POST(req: Request) {
  if (!clientConfig.modules.tienda || !clientConfig.store) {
    return Response.json({ error: "La tienda no está habilitada en este sitio." }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const parsed = checkoutSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Datos inválidos" }, { status: 400 });
  }

  // Los precios se resuelven SIEMPRE desde el config del servidor — el cliente
  // solo manda slugs y cantidades, nunca montos.
  const catalog = new Map(clientConfig.store.products.filter((p) => p.available).map((p) => [p.slug, p]));
  const items = [];
  for (const { slug, qty } of parsed.data.items) {
    const product = catalog.get(slug);
    if (!product) {
      return Response.json({ error: `El producto "${slug}" ya no está disponible.` }, { status: 409 });
    }
    items.push({ slug, name: product.name, price: product.price, qty });
  }
  const total = items.reduce((n, i) => n + i.price * i.qty, 0);

  const order = await createOrder({ items, total, buyer: parsed.data.buyer });

  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(req.url).origin;
  try {
    const tx = await createTransaction({
      buyOrder: order.id,
      sessionId: order.id,
      amount: total,
      returnUrl: `${origin}/api/checkout/retorno`,
    });
    return Response.json({ url: tx.url, token: tx.token, orderId: order.id });
  } catch (e) {
    console.error("[checkout] Webpay create:", e);
    return Response.json(
      { error: "No pudimos conectar con Webpay. Intenta de nuevo en unos minutos." },
      { status: 502 }
    );
  }
}
