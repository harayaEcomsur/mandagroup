import { findCartaByAlias } from "@/lib/mandagroup-catalog";

// URLs fijas de los QR ya impresos (/cmanda.pdf, /carta2026.pdf, /curauma.pdf…):
// cada una está asociada a una carta del panel y redirige a su versión
// VIGENTE — un PDF subido o un link externo. Así, reemplazar una carta en el
// admin actualiza todos sus QR sin reimprimir nada.
//
// Solo atrapa rutas de un nivel que no existen (las páginas, /public y las
// demás rutas tienen prioridad); lo que no es alias de una carta es un 404.
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { file: string } }) {
  const carta = await findCartaByAlias(`/${params.file}`);
  if (!carta) {
    return new Response(
      '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Página no encontrada | Manda Group</title></head><body style="margin:0;min-height:100dvh;display:grid;place-items:center;background:#0B0B0D;color:#F2EFE9;font-family:system-ui,sans-serif;text-align:center"><main><h1 style="font-weight:600">Página no encontrada</h1><p><a href="/" style="color:#E0A83E">Ir a Manda Group</a> · <a href="/carta" style="color:#E0A83E">Ver cartas</a></p></main></body></html>',
      { status: 404, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }
  // 302 (no 301): el destino cambia cada vez que se reemplaza la carta, y un
  // redirect permanente quedaría guardado en el navegador de quien escaneó.
  return new Response(null, {
    status: 302,
    headers: { Location: carta.source.url, "Cache-Control": "no-store" },
  });
}
