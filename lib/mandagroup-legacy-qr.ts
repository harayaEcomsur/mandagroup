// URLs de QR ya impresos (del hosting anterior de mandagroup.cl), con el
// archivo que mostraban. Son PERMANENTES: desde el panel se puede hacer que
// una de estas URLs lleve a otra carta (asignándosela como "URL de QR"), pero
// si ninguna carta la reclama — se borró la carta, se le quitó la URL — vuelve
// sola a su archivo original. Un QR impreso nunca queda roto.
//
// Sin imports a propósito: lo usan tanto el servidor (app/[file]/route.ts)
// como el panel en el navegador (components/eventos/AdminCartas.tsx).
export const LEGACY_QR: Record<string, string> = {
  "/cmanda.pdf": "/cartas/archivo/cmanda.pdf",
  "/cartabarmanda.pdf": "/cartas/archivo/cartabarmanda.pdf",
  "/carta2026.pdf": "/cartas/archivo/carta2026.pdf",
  "/carta.pdf": "/cartas/archivo/carta.pdf",
  "/bar.pdf": "/cartas/archivo/bar.pdf",
  "/espanol1.pdf": "/cartas/archivo/espanol1.pdf",
  "/portugues1.pdf": "/cartas/archivo/portugues2.pdf", // era el mismo archivo que portugues2.pdf
  "/portugues2.pdf": "/cartas/archivo/portugues2.pdf",
  "/curauma.pdf": "/cartas/archivo/curauma.pdf",
};
