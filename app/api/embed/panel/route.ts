import { getEmbedTenant } from "@/config/embed-tenants";
import { adminKeyMatches } from "@/lib/embed-admin";
import { setBookingStatus } from "@/lib/embed-agenda";
import { setOrderStatus } from "@/lib/embed-store";

export const runtime = "nodejs";

// Acciones del panel del dueño (mutaciones), autenticadas con la MISMA clave por
// tenant que protege /embed/panel. Todo scoped por tenant: nunca se toca la data
// de otro negocio.
type Action = "confirmar_reserva" | "cancelar_reserva" | "entregar_pedido";

export async function POST(req: Request) {
  let body: { t?: string; clave?: string; action?: Action; id?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Cuerpo inválido." }, { status: 400 });
  }

  const tenant = getEmbedTenant(body.t);
  if (!tenant) return Response.json({ error: "Negocio no encontrado." }, { status: 404 });
  if (!adminKeyMatches(body.clave, tenant.id)) {
    return Response.json({ error: "No autorizado." }, { status: 401 });
  }
  if (!body.id) return Response.json({ error: "Falta el id." }, { status: 400 });

  let ok = false;
  switch (body.action) {
    case "confirmar_reserva":
      ok = await setBookingStatus(tenant.id, body.id, "confirmada");
      break;
    case "cancelar_reserva":
      ok = await setBookingStatus(tenant.id, body.id, "cancelada");
      break;
    case "entregar_pedido":
      ok = await setOrderStatus(tenant.id, body.id, "entregado");
      break;
    default:
      return Response.json({ error: "Acción desconocida." }, { status: 400 });
  }

  if (!ok) return Response.json({ error: "No se encontró el registro." }, { status: 404 });
  return Response.json({ ok: true });
}
