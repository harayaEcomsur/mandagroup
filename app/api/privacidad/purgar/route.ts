import { purgeExpiredData } from "@/lib/privacy-store";

export const runtime = "nodejs";

// Purga diaria de datos que ya superaron su plazo de retención (Ley 21.719 —
// ver lib/privacy.ts). La dispara Vercel Cron (vercel.json); también acepta
// la clave de admin de la agenda por query para poder probarla a mano, mismo
// criterio que /api/resumen.
function isAuthorized(req: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && req.headers.get("authorization") === `Bearer ${cronSecret}`) return true;
  const adminKey = process.env.AGENDA_ADMIN_KEY ?? process.env.REALESTATE_ADMIN_KEY;
  if (adminKey && new URL(req.url).searchParams.get("clave") === adminKey) return true;
  return false;
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) return Response.json({ error: "No autorizado" }, { status: 401 });

  try {
    const borradas = await purgeExpiredData();
    return Response.json({ ok: true, borradas });
  } catch (error) {
    console.error("Error en la purga de datos vencidos:", error);
    return Response.json({ error: "No se pudo completar la purga" }, { status: 500 });
  }
}
