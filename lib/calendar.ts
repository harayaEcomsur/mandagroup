import { clientConfig } from "@/config/client.config";
import type { Booking } from "@/lib/booking-store";

type BookingLike = Pick<Booking, "id" | "service" | "date" | "time" | "name" | "phone" | "status" | "durationMinutes">;

// Utilidades de calendario para la agenda: link "Agregar a Google Calendar" por
// reserva y feed ICS para suscripción (Google/Outlook/Apple se sincronizan solos).
// Horas en tiempo local del negocio (America/Santiago) — sin OAuth ni APIs de pago.

const TZ = "America/Santiago";

// "2026-07-20" + "15:00" -> ["20260720T150000", "20260720T160000"]
// La duración del evento es la de LA RESERVA (cada servicio puede durar
// distinto), no un bloque global fijo.
function eventTimes(b: BookingLike): [string, string] {
  const [h, m] = b.time.split(":").map(Number);
  const start = new Date(2000, 0, 1, h, m);
  const end = new Date(start.getTime() + b.durationMinutes * 60_000);
  const pad = (n: number) => String(n).padStart(2, "0");
  const day = b.date.replace(/-/g, "");
  const fmt = (d: Date) => `${day}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
  return [fmt(start), fmt(end)];
}

function eventSummary(b: BookingLike): string {
  const estado =
    b.status === "confirmada"
      ? ""
      : b.status === "cancelada"
        ? " (cancelada)"
        : b.status === "pendiente_autorizacion"
          ? " (requiere autorización)"
          : clientConfig.booking?.depositAmount
            ? " (pendiente de abono)"
            : " (pendiente de confirmar)";
  return `${b.service} — ${b.name}${estado}`;
}

function eventDescription(b: BookingLike): string {
  return `Reserva ${b.id} · ${clientConfig.meta.businessName}\nCliente: ${b.name} (${b.phone})\nEstado: ${b.status}`;
}

/** Link "Agregar a Google Calendar" (template URL, un click desde el correo o el panel). */
export function buildGoogleCalendarUrl(b: BookingLike): string {
  const [start, end] = eventTimes(b);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: eventSummary(b),
    dates: `${start}/${end}`,
    details: eventDescription(b),
    ctz: TZ,
  });
  if (clientConfig.contact.address) params.set("location", clientConfig.contact.address);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function icsEscape(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

const ICS_STATUS: Record<Booking["status"], string> = {
  confirmada: "CONFIRMED",
  pendiente: "TENTATIVE",
  pendiente_autorizacion: "TENTATIVE",
  cancelada: "CANCELLED",
};

/** Feed ICS completo de la agenda, para suscribirse desde Google Calendar u Outlook. */
export function buildIcsFeed(bookings: Booking[]): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const stamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;

  const events = bookings.map((b) => {
    const [start, end] = eventTimes(b);
    return [
      "BEGIN:VEVENT",
      `UID:${b.id}@${clientConfig.meta.slug}.agenda`,
      `DTSTAMP:${stamp}`,
      `DTSTART;TZID=${TZ}:${start}`,
      `DTEND;TZID=${TZ}:${end}`,
      `SUMMARY:${icsEscape(eventSummary(b))}`,
      `DESCRIPTION:${icsEscape(eventDescription(b))}`,
      `STATUS:${ICS_STATUS[b.status]}`,
      "END:VEVENT",
    ].join("\r\n");
  });

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:-//HarayaDev//Agenda ${icsEscape(clientConfig.meta.businessName)}//ES`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:Agenda ${icsEscape(clientConfig.meta.businessName)}`,
    `X-WR-TIMEZONE:${TZ}`,
    ...events,
    "END:VCALENDAR",
  ].join("\r\n");
}
