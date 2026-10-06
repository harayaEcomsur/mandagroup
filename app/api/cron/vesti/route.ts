import { revalidatePath, revalidateTag } from "next/cache";
import { listVestiEvents, VESTI_CACHE_TAG } from "@/lib/vesti";

// Cron de Vesti (martes y jueves, ver vercel.json): deja la cartelera lista
// antes de que llegue gente, en vez de que el primer visitante "pague" el
// trabajo.
// 1. Fuerza una lectura nueva de Vesti (invalida la caché de 15 min).
// 2. Regenera la home y /llms.txt con esos datos.
// 3. Pide cada flyer al optimizador de imágenes en los anchos que usa la
//    página: así la primera persona que ve un flyer nuevo no espera a que se
//    procese.
// Fuera de estos días la cartelera igual se refresca sola cada 15 min; esto
// solo adelanta el trabajo.
export const runtime = "nodejs";
export const maxDuration = 60;

function isAuthorized(req: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && req.headers.get("authorization") === `Bearer ${cronSecret}`) return true;
  const adminKey = process.env.AGENDA_ADMIN_KEY;
  if (adminKey && new URL(req.url).searchParams.get("clave") === adminKey) return true;
  return false;
}

// Anchos que el navegador pide para los flyers (tarjetas de 19rem y el de la
// portada) según la densidad de pantalla — ver `sizes` en MandagroupHome.
const FLYER_WIDTHS = [384, 640, 750, 828, 1080];

export async function GET(req: Request) {
  if (!isAuthorized(req)) return Response.json({ error: "No autorizado" }, { status: 401 });

  revalidateTag(VESTI_CACHE_TAG);
  const events = await listVestiEvents();
  revalidatePath("/");
  revalidatePath("/llms.txt");

  const prod = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  const base = prod ? `https://${prod}` : (process.env.NEXT_PUBLIC_SITE_URL ?? new URL(req.url).origin);

  // La home primero (dispara su regeneración), después los flyers.
  const home = await fetch(base, { cache: "no-store" }).then((r) => r.status).catch(() => 0);
  const urls = events
    .filter((e) => e.imageUrl)
    .flatMap((e) =>
      FLYER_WIDTHS.map((w) => `${base}/_next/image?url=${encodeURIComponent(e.imageUrl!)}&w=${w}&q=75`)
    );
  const results = await Promise.all(
    urls.map((u) =>
      fetch(u, { headers: { Accept: "image/webp,image/*" }, cache: "no-store" })
        .then((r) => r.ok)
        .catch(() => false)
    )
  );

  return Response.json({
    eventos: events.length,
    home,
    imagenes: { pedidas: urls.length, ok: results.filter(Boolean).length },
  });
}
