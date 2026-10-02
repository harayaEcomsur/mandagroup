import { clientConfig } from "@/config/client.config";
import { createBooking, getNotify, consumeNotifyQuota, professionalDisplayName, type Booking } from "@/lib/booking-store";
import { buildBookingClientWaLink, buildWhatsAppLink } from "@/lib/whatsapp";
import { buildGoogleCalendarUrl } from "@/lib/calendar";

// Creación de reservas con avisos al dueño — lógica compartida entre la API de
// la agenda (POST /api/agenda) y las tools del asistente IA (chat del sitio y
// WhatsApp). Una sola implementación: la reserva creada conversando pasa por
// exactamente el mismo camino que la del formulario.

export async function notifyByEmail(subject: string, text: string, toOverride?: string, cc?: string) {
  const apiKey = process.env.RESEND_API_KEY;
  const to = toOverride ?? process.env.BOOKINGS_NOTIFY_EMAIL;
  if (!apiKey || !to) return false;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || "Agenda <onboarding@resend.dev>",
        to,
        ...(cc ? { cc } : {}),
        subject,
        text,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// Aviso por WhatsApp AL DUEÑO, enviado desde el número de HarayaDev (Cloud API).
// Requiere NOTIFY_WA_TOKEN + NOTIFY_WA_PHONE_ID (la app de Meta de HarayaDev) y,
// fuera de la ventana de 24h, una plantilla utility aprobada (NOTIFY_WA_TEMPLATE).
export async function notifyByWhatsApp(to: string, text: string): Promise<boolean> {
  const token = process.env.NOTIFY_WA_TOKEN;
  const phoneId = process.env.NOTIFY_WA_PHONE_ID;
  if (!token || !phoneId || !to) return false;
  try {
    const template = process.env.NOTIFY_WA_TEMPLATE;
    const body = template
      ? {
          messaging_product: "whatsapp",
          to: to.replace(/[^\d]/g, ""),
          type: "template",
          template: {
            name: template,
            language: { code: "es" },
            components: [{ type: "body", parameters: [{ type: "text", text }] }],
          },
        }
      : {
          messaging_product: "whatsapp",
          to: to.replace(/[^\d]/g, ""),
          type: "text",
          text: { body: text },
        };
    const res = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export function defaultOwnerWhatsapp(): string | undefined {
  const digits = (n?: string) => (n ? n.replace(/\D/g, "") : "");
  const fromConfig = clientConfig.booking?.ownerNotifyWhatsapp ?? clientConfig.contact.whatsapp;
  return digits(fromConfig).length >= 8 ? fromConfig : undefined;
}

export async function notifyTargets(): Promise<{ email?: string; whatsapp?: string }> {
  const n = await getNotify();
  const whatsapp = n.whatsapp ?? defaultOwnerWhatsapp();
  return {
    email: n.email ?? clientConfig.booking?.ownerNotifyEmail ?? process.env.BOOKINGS_NOTIFY_EMAIL,
    whatsapp,
  };
}

// El nombre del profesional lo resuelve quien llama (createBookingAndNotify,
// ya async) — así esta función se queda síncrona y sin tocar la base/config
// de nuevo. En agenda compartida (de siempre) professionalName es null y no
// aparece la línea "Con: ..." — sería ruido ("con Mi Negocio").
export function bookingSummary(booking: {
  id: string;
  service: string;
  date: string;
  time: string;
  name: string;
  phone: string;
  status?: Booking["status"];
  professionalName?: string | null;
}) {
  // "pendiente" es el estado por defecto de TODA reserva nueva (con o sin
  // abono) hasta que el dueño la confirma en el panel — no es sinónimo de
  // "espera pago". El texto "PENDIENTE DE ABONO" solo aplica a negocios que
  // configuraron booking.depositAmount; el resto (ej. un estudio jurídico que
  // agenda una consulta gratuita) solo necesita que el dueño la confirme.
  const encabezado =
    booking.status === "pendiente_autorizacion"
      ? `⚠️ Reserva REQUIERE AUTORIZACIÓN (supera el tope de horas del día) en ${clientConfig.meta.businessName}:`
      : clientConfig.booking?.depositAmount
        ? `Reserva PENDIENTE DE ABONO en ${clientConfig.meta.businessName}:`
        : `Nueva reserva pendiente de confirmar en ${clientConfig.meta.businessName}:`;
  return [
    encabezado,
    ``,
    `Servicio: ${booking.service}`,
    ...(booking.professionalName ? [`Con: ${booking.professionalName}`] : []),
    `Fecha: ${booking.date} a las ${booking.time}`,
    `Cliente: ${booking.name} · ${booking.phone}`,
    ``,
    `Autorízala o confírmala en el panel: /agenda/admin`,
  ].join("\n");
}

export function emailWithWaLinks(
  summary: string,
  booking: {
    id: string;
    service: string;
    date: string;
    time: string;
    name: string;
    phone: string;
    status: Booking["status"];
    durationMinutes: number;
  },
  targets: { email?: string; whatsapp?: string }
): string {
  const lines = [summary, ""];
  if (targets.whatsapp && targets.whatsapp.replace(/\D/g, "").length >= 8) {
    lines.push(
      `📱 Abrir aviso en tu WhatsApp (gratis, wa.me):`,
      buildWhatsAppLink(targets.whatsapp, summary),
      ""
    );
  }
  if (booking.phone.replace(/\D/g, "").length >= 8) {
    lines.push(
      `💬 Escribir a la clienta por WhatsApp:`,
      buildBookingClientWaLink(booking, clientConfig.meta.businessName),
      ""
    );
  }
  lines.push(`📅 Agregar a tu Google Calendar:`, buildGoogleCalendarUrl(booking));
  return lines.join("\n");
}

// Cuando un miembro del staff (no el admin) confirma/cancela una reserva o
// bloquea un horario, el admin se entera por el mismo canal que usa para las
// reservas nuevas — no hay panel de auditoría, así que esto es lo que hay.
export async function notifyAdminOfStaffAction(actorEmail: string, action: string): Promise<void> {
  const targets = await notifyTargets();
  const quotaOk = await consumeNotifyQuota();
  if (!quotaOk) return;
  const text = `👤 ${actorEmail} (staff) ${action} en tu agenda — ${clientConfig.meta.businessName}.`;
  await Promise.all([
    notifyByEmail(`Cambio de staff en tu agenda — ${clientConfig.meta.businessName}`, text, targets.email),
    targets.whatsapp && process.env.NOTIFY_WA_TOKEN ? notifyByWhatsApp(targets.whatsapp, text) : Promise.resolve(false),
  ]);
}

export interface CreateBookingResult {
  ok: boolean;
  booking?: Booking;
  error?: string;
  emailSent?: boolean;
  whatsappSent?: boolean;
  waNotifyUrl?: string | null;
  depositNote?: string;
}

// Crea la reserva (validando el slot contra el motor de la agenda — nunca
// contra lo que "cree" quien llama) y dispara los avisos al dueño.
export async function createBookingAndNotify(data: {
  service: string;
  date: string;
  time: string;
  name: string;
  phone: string;
  professionalId?: string;
  branchId?: string;
}): Promise<CreateBookingResult> {
  const result = await createBooking(data);
  if ("error" in result) return { ok: false, error: result.error };

  const [targets, professionalName] = await Promise.all([
    notifyTargets(),
    professionalDisplayName(result.professionalId),
  ]);
  const summary = bookingSummary({ ...result, professionalName });
  const emailBody = emailWithWaLinks(summary, result, targets);
  const quotaOk = await consumeNotifyQuota();
  const subject =
    result.status === "pendiente_autorizacion"
      ? `⚠️ Reserva ${result.id} requiere autorización — ${result.service} (${clientConfig.meta.businessName})`
      : `📅 Nueva reserva ${result.id} — ${result.service} (${clientConfig.meta.businessName})`;
  const [emailSent, whatsappSent] = await Promise.all([
    quotaOk ? notifyByEmail(subject, emailBody, targets.email) : Promise.resolve(false),
    quotaOk && targets.whatsapp && process.env.NOTIFY_WA_TOKEN
      ? notifyByWhatsApp(targets.whatsapp, summary)
      : Promise.resolve(false),
  ]);

  return {
    ok: true,
    booking: result,
    emailSent,
    whatsappSent,
    waNotifyUrl:
      targets.whatsapp && targets.whatsapp.replace(/\D/g, "").length >= 8
        ? buildWhatsAppLink(targets.whatsapp, summary)
        : null,
    depositNote: clientConfig.booking?.depositNote,
  };
}
