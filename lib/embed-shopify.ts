// Conector de "concierge de tienda" para tenants del asistente embebible cuya
// tienda real vive en Shopify (Yuki Pet, Aura May, prospectos actuales).
//
// A diferencia de Dentalink/AgendaPro, esto NO necesita ningún token del
// cliente: Shopify expone endpoints públicos same-origin que cualquier script
// en el dominio de la tienda puede usar tal como lo hace el propio tema:
//   - GET  /search/suggest.json  → catálogo en vivo (búsqueda)
//   - GET  /products/<handle>.js → producto + variantes reales
//   - POST /cart/add.js          → agrega al carrito REAL de esa visita
// Los dos primeros los llama este archivo (server-side, desde la tool). El
// tercero NO puede resolverse acá: el carrito vive en una cookie del
// NAVEGADOR de la visita, así que lo ejecuta directo public/widget.js cuando
// el visitante hace clic en el botón — ver ahí el fetch a /cart/add.js.

export interface ShopifySearchResult {
  handle: string;
  title: string;
  price: number; // CLP
  available: boolean;
}

export interface ShopifyVariant {
  id: number;
  title: string;
  available: boolean;
  price: number; // CLP
}

export interface ShopifyProduct {
  title: string;
  handle: string;
  variants: ShopifyVariant[];
}

// OJO — los dos endpoints de Shopify representan el precio DISTINTO, verificado
// en vivo contra yukipet.cl y auramay.cl (scripts/test-embed-shopify.ts):
// /search/suggest.json entrega el precio ya en pesos ("12990" = $12.990), pero
// /products/<handle>.js (familia AJAX Cart/Product) lo entrega ×100 (1299000),
// la misma convención que /cart/add.js espera para line_price. Dividir por 100
// acá y NO en la búsqueda es lo correcto para ambos — mezclarlos rompe el
// precio silenciosamente (mostraría $129,9 en vez de $12.990).
function centsToClp(shopifyPrice: number): number {
  return Math.round(shopifyPrice) / 100;
}

export async function searchShopifyProducts(domain: string, query: string, limit = 5): Promise<ShopifySearchResult[]> {
  const url = new URL(`https://${domain}/search/suggest.json`);
  url.searchParams.set("q", query);
  url.searchParams.set("resources[type]", "product");
  url.searchParams.set("resources[limit]", String(limit));

  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`Shopify search ${domain} falló (${res.status})`);
  const data = (await res.json()) as { resources?: { results?: { products?: Record<string, unknown>[] } } };
  const products = data.resources?.results?.products ?? [];
  return products.map((p) => ({
    handle: String(p.handle),
    title: String(p.title),
    price: Number(p.price),
    available: Boolean(p.available),
  }));
}

export async function getShopifyProduct(domain: string, handle: string): Promise<ShopifyProduct | null> {
  const res = await fetch(`https://${domain}/products/${encodeURIComponent(handle)}.js`, {
    headers: { Accept: "application/json" },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Shopify product ${domain}/${handle} falló (${res.status})`);
  const data = (await res.json()) as {
    title: string;
    handle: string;
    variants: { id: number; title: string; available: boolean; price: number }[];
  };
  return {
    title: data.title,
    handle: data.handle,
    variants: data.variants.map((v) => ({ id: v.id, title: v.title, available: v.available, price: centsToClp(v.price) })),
  };
}
