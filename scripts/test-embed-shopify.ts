#!/usr/bin/env tsx
// Prueba del concierge de tienda Shopify (lib/embed-shopify.ts) CONTRA LAS
// TIENDAS REALES de los prospectos (yukipet.cl, auramay.cl) — sin gastar cuota
// del modelo ni tocar carritos: solo búsqueda y ficha de producto (GET,
// endpoints públicos de Shopify). Correr: npx tsx scripts/test-embed-shopify.ts
import { searchShopifyProducts, getShopifyProduct } from "../lib/embed-shopify";

let fail = 0;
const check = (name: string, cond: boolean) => {
  console.log(`${cond ? "✓" : "✗"} ${name}`);
  if (!cond) fail++;
};

async function testStore(domain: string, query: string) {
  console.log(`\n— ${domain} —`);
  const results = await searchShopifyProducts(domain, query);
  check(`buscar_productos("${query}") devuelve resultados reales`, results.length > 0);
  if (results.length === 0) return;

  const first = results[0];
  console.log(`  primer resultado: ${first.title} — $${first.price.toLocaleString("es-CL")} (handle: ${first.handle})`);
  check("precio es un número > 0 (no string, no NaN)", typeof first.price === "number" && first.price > 0);

  const product = await getShopifyProduct(domain, first.handle);
  check("getShopifyProduct resuelve el handle devuelto por la búsqueda", product !== null);
  if (!product) return;

  check("el producto tiene al menos una variante", product.variants.length > 0);
  const variant = product.variants[0];
  console.log(`  variante: id=${variant.id} título="${variant.title}" disponible=${variant.available} precio=$${variant.price}`);
  check("la variante tiene un id numérico real (para /cart/add.js)", typeof variant.id === "number" && variant.id > 0);

  const boton = `{{cart-add:${variant.id}:1:${product.title}}}`;
  console.log(`  sentinel que emitiría agregar_al_carrito: ${boton}`);
}

async function main() {
  await testStore("yukipet.cl", "juguete");
  await testStore("auramay.cl", "crema");

  console.log(fail === 0 ? "\nTodo ok." : `\n${fail} fallo(s).`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
