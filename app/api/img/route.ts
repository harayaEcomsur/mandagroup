import sharp from "sharp";

// Redimensionador propio para imágenes externas (flyers de Vesti, fotos de
// Instagram). Reemplaza al optimizador de Vercel (/_next/image), cuya cuota
// mensual se agotó y devolvía 402 → imagen rota. La respuesta queda en la CDN
// un año: cada combinación url+ancho se procesa una sola vez.
// Solo hosts conocidos, para no ser un proxy abierto.
const ALLOWED = [/(^|\.)vesti\.cl$/, /(^|\.)cdninstagram\.com$/, /(^|\.)fbcdn\.net$/, /(^|\.)public\.blob\.vercel-storage\.com$/];
const MAX_W = 1920;

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const src = params.get("url");
  const w = Math.min(Math.max(Number(params.get("w")) || 640, 16), MAX_W);
  const q = Math.min(Math.max(Number(params.get("q")) || 75, 30), 90);
  let target: URL;
  try {
    target = new URL(src ?? "");
  } catch {
    return new Response("bad url", { status: 400 });
  }
  if (target.protocol !== "https:" || !ALLOWED.some((re) => re.test(target.hostname))) {
    return new Response("host not allowed", { status: 400 });
  }

  const upstream = await fetch(target, { cache: "no-store" });
  if (!upstream.ok) return new Response("upstream error", { status: 502, headers: { "Cache-Control": "no-store" } });
  const input = Buffer.from(await upstream.arrayBuffer());
  try {
    const out = await sharp(input).rotate().resize({ width: w, withoutEnlargement: true }).webp({ quality: q }).toBuffer();
    return new Response(new Uint8Array(out), {
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new Response("bad image", { status: 415, headers: { "Cache-Control": "no-store" } });
  }
}
