import { clientConfig } from "@/config/client.config";
import { listBookings } from "@/lib/booking-store";
import { buildIcsFeed } from "@/lib/calendar";

// Feed ICS de la agenda para suscripción desde Google Calendar / Outlook / Apple.
// Protegido con la clave de admin vía query (?clave=) porque los calendarios no
// envían headers al refrescar. Google refresca feeds por URL cada algunas horas.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!clientConfig.modules.agenda) return new Response("No disponible", { status: 404 });
  const key = process.env.AGENDA_ADMIN_KEY;
  const clave = new URL(req.url).searchParams.get("clave");
  if (!key || clave !== key) return new Response("No autorizado", { status: 401 });

  return new Response(buildIcsFeed(await listBookings()), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `inline; filename="agenda-${clientConfig.meta.slug}.ics"`,
      "Cache-Control": "no-store",
    },
  });
}
