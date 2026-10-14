// A qué Pixel de Meta (además del general del grupo) le corresponde cada
// acción del sitio: cada marca puede tener el suyo para armar públicos y
// optimizar sus propios anuncios. Las páginas lo marcan con
// data-pixel-brand en el enlace; components/analytics/MetaPixel lo lee.
// Sin Pixel propio configurado, la acción va solo al general.

export type PixelBrand = "renaca" | "vina" | "carbon" | "costa";

export const PIXEL_BRANDS: PixelBrand[] = ["renaca", "vina", "carbon", "costa"];

// Eventos de Vesti (también decide en qué página de marca aparecen): los de cada club van a su Pixel; los de otras cuentas
// (Costa Nights, Eventos & Stand Up) solo si son en un local del grupo — ej.
// el show de Luis Jara en Carbón. El resto, solo al general.
export function eventPixelBrand(e: { venue: string; place?: string | null; title?: string }): PixelBrand | null {
  if (e.venue === "renaca" || e.venue === "vina") return e.venue;
  // Una promo de Costa Sushi puede venderse con la dirección de Carbón (ej.
  // "CYBER DAYS COSTA SUSHI"): manda la marca que dice el nombre.
  if (e.title && /costa sushi/i.test(e.title)) return "costa";
  if (e.place && /carb[oó]n/i.test(e.place)) return "carbon";
  if (e.place && /costa sushi/i.test(e.place)) return "costa";
  return null;
}

// Locales y cartas: Carbon y Costa Sushi por marca; Manda según el local.
export function localPixelBrand(l: { id: string; brand: string }): PixelBrand | null {
  if (l.brand === "carbon" || l.brand === "costa") return l.brand;
  if (l.brand === "manda") return l.id.includes("vina") ? "vina" : l.id.includes("renaca") ? "renaca" : null;
  return null;
}
