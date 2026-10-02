import { tool, type ToolSet } from "ai";
import { z } from "zod";
import { clientConfig } from "@/config/client.config";
import { createOrder } from "@/lib/order-store";
import { createTransaction } from "@/lib/webpay";
import { formatCLP } from "@/lib/clp";

// Tool de la tienda conversacional: el asistente no deriva a /tienda — vende.
// Mismo criterio que /api/checkout: el modelo solo entrega slugs y cantidades;
// los precios y el total se resuelven SIEMPRE desde el config del servidor.
// El pedido es real (createOrder + Webpay) y el link de pago se compone igual
// que la redirección de CheckoutView: `${url}?token_ws=${token}`.

// Normaliza para comparar slugs sin tildes ni mayúsculas.
function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

// Slugs del catálogo parecidos al pedido (comparten substring o alguna palabra),
// para que el asistente pueda corregir al cliente sin inventar productos.
function similarSlugs(wanted: string, catalogSlugs: string[]): string[] {
  const w = norm(wanted);
  const words = w.split(/[^a-z0-9]+/).filter((p) => p.length >= 3);
  return catalogSlugs.filter((slug) => {
    const s = norm(slug);
    return s.includes(w) || w.includes(s) || words.some((p) => s.includes(p));
  });
}

export function buildStoreTools(): ToolSet {
  // Mismo gating que /api/checkout; sin productos disponibles tampoco hay tool.
  if (!clientConfig.modules.tienda || !clientConfig.store) return {};
  if (!clientConfig.store.products.some((p) => p.available)) return {};

  return {
    crear_pedido: tool({
      description:
        "Crea un pedido REAL de la tienda y entrega el link de pago Webpay. Solo llamar cuando el cliente ya eligió productos y cantidades y entregó su nombre y teléfono. Nunca inventes productos ni precios: usa únicamente slugs del catálogo del negocio.",
      inputSchema: z.object({
        items: z
          .array(
            z.object({
              slug: z.string().describe("Slug exacto del producto en el catálogo."),
              cantidad: z.number().int().positive().max(99).describe("Cantidad de unidades."),
            })
          )
          .min(1)
          .describe("Productos elegidos por el cliente."),
        nombre: z.string().min(2).max(120).describe("Nombre del cliente."),
        telefono: z.string().min(6).max(30).describe("Teléfono del cliente (ej. +56 9 1234 5678)."),
        email: z.string().email().optional().describe("Email del cliente, si lo entregó."),
      }),
      execute: async ({ items, nombre, telefono, email }) => {
        // Catálogo disponible — mismo criterio que /api/checkout: solo available.
        const store = clientConfig.store!;
        const catalog = new Map(store.products.filter((p) => p.available).map((p) => [p.slug, p]));

        // Resolver CADA slug contra el catálogo; los precios salen del servidor.
        const resolved: { slug: string; name: string; price: number; qty: number }[] = [];
        for (const { slug, cantidad } of items) {
          const product = catalog.get(slug);
          if (!product) {
            const parecidos = similarSlugs(slug, [...catalog.keys()]);
            return {
              error:
                `El producto "${slug}" no existe o no está disponible.` +
                (parecidos.length > 0 ? ` ¿Quisiste decir: ${parecidos.join(", ")}?` : ""),
              slugsValidos: [...catalog.keys()],
            };
          }
          resolved.push({ slug, name: product.name, price: product.price, qty: cantidad });
        }

        // Total calculado en servidor, nunca el que diga el modelo.
        const total = resolved.reduce((n, i) => n + i.price * i.qty, 0);

        // Mismo shape que el checkout; el email es obligatorio en Order pero el
        // chat puede no tenerlo — se guarda vacío y el contacto queda por teléfono.
        const order = await createOrder({
          items: resolved,
          total,
          buyer: { name: nombre, email: email ?? "", phone: telefono, note: "Pedido creado por el asistente del chat." },
        });

        const origin = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
        try {
          const tx = await createTransaction({
            buyOrder: order.id,
            sessionId: order.id,
            amount: total,
            returnUrl: `${origin}/api/checkout/retorno`,
          });
          return {
            ok: true,
            pedidoId: order.id,
            total,
            totalFormateado: formatCLP(total),
            // Igual que la redirección de CheckoutView: formulario Webpay + token.
            linkPago: `${tx.url}?token_ws=${encodeURIComponent(tx.token)}`,
            resumen: resolved.map((i) => ({
              producto: i.name,
              cantidad: i.qty,
              subtotal: formatCLP(i.price * i.qty),
            })),
            nota: store.shippingNote,
          };
        } catch (e) {
          console.error("[store-tools] Webpay create:", e);
          return {
            error:
              "No pudimos conectar con Webpay para generar el link de pago. Pide al cliente intentar de nuevo en unos minutos o comprar desde la página de la tienda.",
          };
        }
      },
    }),
  };
}
