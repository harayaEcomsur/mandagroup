import { put } from "@vercel/blob";
import { clientConfig } from "@/config/client.config";
import { currentBroker } from "@/lib/realestate-auth";

export const runtime = "nodejs";

// Recibe UNA imagen ya redimensionada/comprimida en el navegador (ver
// components/inmobiliaria/PhotoUploader.tsx — canvas a máx. 1600px, JPEG
// ~0.75) y la sube a Vercel Blob. El límite server-side es un resguardo, no la
// estrategia de peso: la compresión real pasa en el cliente antes de llegar
// acá, para no gastar ancho de banda subiendo fotos de cámara sin tocar.
const MAX_BYTES = 3 * 1024 * 1024;

function claveFromRequest(req: Request): string | null {
  return req.headers.get("x-re-key") ?? new URL(req.url).searchParams.get("clave");
}

export async function POST(req: Request) {
  if (!clientConfig.modules.inmobiliariaAdmin) return Response.json({ error: "No habilitado" }, { status: 404 });
  const broker = await currentBroker(claveFromRequest(req));
  if (!broker) return Response.json({ error: "No autorizado" }, { status: 401 });

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return Response.json({ error: "La subida de fotos no está configurada en este sitio (falta Vercel Blob)." }, { status: 503 });
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return Response.json({ error: "Falta el archivo" }, { status: 400 });
  if (file.size > MAX_BYTES) return Response.json({ error: "La imagen pesa demasiado" }, { status: 413 });
  if (!file.type.startsWith("image/")) return Response.json({ error: "Solo se aceptan imágenes" }, { status: 400 });

  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const pathname = `inmobiliaria/${clientConfig.meta.slug}/${broker.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const blob = await put(pathname, file, { access: "public", contentType: file.type });
  return Response.json({ ok: true, url: blob.url });
}
