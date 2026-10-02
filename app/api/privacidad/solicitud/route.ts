import { z } from "zod";
import { clientConfig } from "@/config/client.config";
import { createPrivacyRequest } from "@/lib/privacy-store";
import { notifyByEmail } from "@/lib/booking-actions";
import { arcoEmail } from "@/lib/privacy";

export const runtime = "nodejs";

// Canal de derechos ARCO+ (Ley 21.719): acceso, rectificación, cancelación,
// oposición, portabilidad, bloqueo. Cualquiera puede pedirlo — no requiere
// login, porque quien pide "cancelar mis datos" puede no tener cuenta en
// ningún panel. La solicitud queda registrada (para poder auditar el plazo
// de 30 días) y le llega por email al dueño del negocio para que la resuelva.
const bodySchema = z.object({
  tipo: z.enum(["acceso", "rectificacion", "cancelacion", "oposicion", "portabilidad", "bloqueo"]),
  nombre: z.string().min(2).max(120),
  contacto: z.string().min(3).max(200),
  detalle: z.string().max(2000).optional(),
});

const TIPO_LABEL: Record<string, string> = {
  acceso: "Acceso",
  rectificacion: "Rectificación",
  cancelacion: "Cancelación / eliminación",
  oposicion: "Oposición",
  portabilidad: "Portabilidad",
  bloqueo: "Bloqueo temporal",
};

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Datos inválidos" }, { status: 400 });

  const request = await createPrivacyRequest(parsed.data);

  await notifyByEmail(
    `Solicitud de datos personales (${TIPO_LABEL[request.tipo]}) — ${clientConfig.meta.businessName}`,
    [
      `Tipo: ${TIPO_LABEL[request.tipo]}`,
      `Nombre: ${request.nombre}`,
      `Contacto: ${request.contacto}`,
      request.detalle ? `Detalle: ${request.detalle}` : "",
      ``,
      `Plazo legal de respuesta: ${new Date(request.plazoRespuesta).toLocaleDateString("es-CL")} (30 días desde hoy).`,
      `Solicitud registrada: ${request.id}`,
    ]
      .filter(Boolean)
      .join("\n"),
    arcoEmail()
  );

  return Response.json({ ok: true });
}
