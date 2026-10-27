import { clientConfig } from "@/config/client.config";
import { currentAdminUser } from "@/lib/auth";
import { listIgEvents } from "@/lib/ig-inbox-log";

// Bandeja de Instagram para /eventos/admin (lib/ig-inbox-log.ts). Va aparte de
// GET /api/eventos para no cargar 30 días de mensajes en cada apertura del panel:
// se pide solo al abrir esa sección. Mismo acceso que el resto del panel.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!clientConfig.modules.eventos) return Response.json({ error: "Módulo no habilitado" }, { status: 404 });
  const clave = req.headers.get("x-eventos-key") ?? new URL(req.url).searchParams.get("clave");
  const user = await currentAdminUser(clave);
  if (!user) return Response.json({ error: "No autorizado" }, { status: 401 });

  const days = Math.min(30, Math.max(1, Number(new URL(req.url).searchParams.get("days")) || 7));
  return Response.json({ days, events: await listIgEvents(days) });
}
