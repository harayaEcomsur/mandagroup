import { tool, type ToolSet } from "ai";
import { z } from "zod";
import { clientConfig } from "@/config/client.config";
import { createLead, type Lead } from "@/lib/lead-store";
import { notifyByEmail, notifyByWhatsApp, defaultOwnerWhatsapp } from "@/lib/booking-actions";
import { buildWhatsAppLink } from "@/lib/whatsapp";

// Tool de captura de leads del módulo inmobiliario: el asistente conversa con el
// interesado, junta presupuesto/comuna/operación y registra un lead calificado
// que le llega al dueño por email y WhatsApp (mismos canales que la agenda).
// El modelo jamás inventa datos: la tool solo se llama con lo que el interesado
// entregó de verdad.

const OPERACION_LABEL: Record<Lead["operacion"], string> = {
  compra: "Compra",
  arriendo: "Arriendo",
  no_sabe: "Aún no lo tiene claro",
};

// Resumen legible del lead para el aviso al dueño — mismo estilo que bookingSummary.
function leadSummary(lead: Lead): string {
  const lines = [
    `Nuevo LEAD CALIFICADO en ${clientConfig.meta.businessName}:`,
    ``,
    `Operación: ${OPERACION_LABEL[lead.operacion]}`,
    `Comunas: ${lead.comunas.join(", ")}`,
  ];
  if (lead.presupuesto) lines.push(`Presupuesto: ${lead.presupuesto}`);
  if (lead.plazo) lines.push(`Plazo: ${lead.plazo}`);
  if (lead.propiedadInteres) lines.push(`Propiedad de interés: /propiedades/${lead.propiedadInteres}`);
  if (lead.notas) lines.push(`Notas: ${lead.notas}`);
  lines.push(``, `Interesado: ${lead.nombre} · ${lead.telefono} (lead ${lead.id})`);
  return lines.join("\n");
}

// Cuerpo del email: resumen + link wa.me listo para escribirle al interesado
// con mensaje prellenado — mismo estilo que emailWithWaLinks de la agenda.
function leadEmailBody(lead: Lead, summary: string): string {
  const lines = [summary];
  if (lead.telefono.replace(/\D/g, "").length >= 8) {
    lines.push(
      ``,
      `💬 Escribir al interesado por WhatsApp:`,
      buildWhatsAppLink(
        lead.telefono,
        `Hola ${lead.nombre}! Te escribo de ${clientConfig.meta.businessName} por tu búsqueda de propiedad 😊`
      )
    );
  }
  return lines.join("\n");
}

export function buildLeadTools(): ToolSet {
  if (!clientConfig.modules.propiedades) return {};

  return {
    registrar_lead: tool({
      description:
        "Registra un lead REAL de un interesado en propiedades y avisa al dueño del negocio. Solo llamar cuando el interesado ya entregó su nombre, su teléfono y al menos operación + comuna o presupuesto. Nunca inventes datos ni la llames sin un teléfono real entregado por el interesado.",
      inputSchema: z.object({
        nombre: z.string().min(2).max(120).describe("Nombre del interesado, tal como lo dio."),
        telefono: z
          .string()
          .min(6)
          .max(20)
          .describe("Teléfono real del interesado (ej. +56 9 1234 5678). Nunca inventarlo."),
        operacion: z
          .enum(["compra", "arriendo", "no_sabe"])
          .describe("Qué busca: comprar, arrendar, o 'no_sabe' si aún no lo decide."),
        comunas: z
          .array(z.string())
          .min(1)
          .describe("Comunas o sectores donde busca propiedad (ej. ['Viña del Mar', 'Concón'])."),
        presupuesto: z
          .string()
          .optional()
          .describe("Presupuesto aproximado tal como lo dijo el interesado (ej. 'hasta 4.500 UF', '$600.000 mensuales')."),
        plazo: z
          .string()
          .optional()
          .describe("Horizonte para concretar, si lo mencionó (ej. 'este mes', '3 a 6 meses', 'solo mirando')."),
        propiedadInteres: z
          .string()
          .optional()
          .describe("Slug de la propiedad publicada que le interesó (ej. 'depto-centro-vina'), solo si preguntó por una en concreto."),
        notas: z
          .string()
          .optional()
          .describe("Otros requisitos relevantes que mencionó: dormitorios, mascotas, estacionamiento, financiamiento, etc."),
      }),
      execute: async (data) => {
        try {
          const lead = await createLead(data);

          // Avisos al dueño, mismo criterio que la agenda: email siempre que haya
          // destino configurado; WhatsApp por Cloud API solo si hay NOTIFY_WA_TOKEN.
          const summary = leadSummary(lead);
          const emailTo = clientConfig.booking?.ownerNotifyEmail ?? process.env.BOOKINGS_NOTIFY_EMAIL;
          const ownerWhatsapp = defaultOwnerWhatsapp();
          await Promise.all([
            notifyByEmail(
              `🏠 Nuevo lead ${lead.id} — ${OPERACION_LABEL[lead.operacion]} en ${lead.comunas.join(", ")} (${clientConfig.meta.businessName})`,
              leadEmailBody(lead, summary),
              emailTo
            ),
            ownerWhatsapp && process.env.NOTIFY_WA_TOKEN
              ? notifyByWhatsApp(ownerWhatsapp, summary)
              : Promise.resolve(false),
          ]);

          return { ok: true, leadId: lead.id };
        } catch {
          return { error: "No se pudo registrar el lead — intenta de nuevo o deriva al WhatsApp del negocio." };
        }
      },
    }),
  };
}
