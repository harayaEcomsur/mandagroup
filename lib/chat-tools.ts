import { tool, type ToolSet } from "ai";
import { z } from "zod";
import { clientConfig } from "@/config/client.config";
import { slotsForDate } from "@/lib/booking-store";
import { createBookingAndNotify } from "@/lib/booking-actions";

// Tools de la agenda conversacional: el asistente no deriva a /agenda — agenda.
// La única fuente de verdad de disponibilidad es el motor de la agenda
// (slotsForDate/createBooking); el modelo jamás confirma nada por su cuenta.
// Se usan en el chat del sitio y en el webhook de WhatsApp (mismo cerebro).

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function todayISO(): string {
  // Fecha en horario de Chile continental, no del servidor (Vercel corre en UTC).
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago" }).format(new Date());
}

function addDays(date: string, days: number): string {
  const d = new Date(date + "T12:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function dayLabel(date: string): string {
  return new Intl.DateTimeFormat("es-CL", {
    timeZone: "America/Santiago",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(date + "T12:00:00"));
}

// Busca el servicio del config que mejor calza con lo que escribió el cliente
// (sin tildes ni mayúsculas). Devuelve el título oficial o null.
function matchService(input: string): string | null {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  const wanted = norm(input);
  const titles = clientConfig.services.map((s) => s.title);
  return (
    titles.find((t) => norm(t) === wanted) ??
    titles.find((t) => norm(t).includes(wanted) || wanted.includes(norm(t))) ??
    null
  );
}

export function buildAgendaTools(): ToolSet {
  if (!clientConfig.modules.agenda) return {};

  return {
    consultar_disponibilidad: tool({
      description:
        "Consulta los horarios REALMENTE disponibles de la agenda. Sin fecha: resume los próximos días con horas libres. Con fecha (YYYY-MM-DD): lista las horas libres de ese día. Úsala SIEMPRE antes de ofrecer un horario.",
      inputSchema: z.object({
        fecha: z
          .string()
          .regex(DATE_RE)
          .optional()
          .describe("Fecha exacta a consultar, formato YYYY-MM-DD. Omitir para ver un resumen de los próximos días."),
        servicio: z
          .string()
          .optional()
          .describe("Servicio que quiere el cliente, si ya se sabe — cada servicio dura distinto y eso cambia qué horas caben."),
      }),
      execute: async ({ fecha, servicio }) => {
        const daysAhead = clientConfig.booking?.daysAhead ?? 14;
        const today = todayISO();
        const service = servicio ? (matchService(servicio) ?? undefined) : undefined;

        if (fecha) {
          if (fecha < today) return { error: "Esa fecha ya pasó." };
          if (fecha > addDays(today, daysAhead))
            return { error: `Solo se puede reservar hasta ${daysAhead} días hacia adelante.` };
          const libres = (await slotsForDate(fecha, service))
            .filter((s) => s.available)
            .map((s) => s.time);
          return {
            fecha,
            dia: dayLabel(fecha),
            horasDisponibles: libres,
            sinAtencion: libres.length === 0,
          };
        }

        const resumen: { fecha: string; dia: string; horasDisponibles: string[] }[] = [];
        for (let i = 1; i <= daysAhead && resumen.length < 5; i++) {
          const d = addDays(today, i);
          const libres = (await slotsForDate(d, service))
            .filter((s) => s.available)
            .map((s) => s.time);
          if (libres.length > 0) resumen.push({ fecha: d, dia: dayLabel(d), horasDisponibles: libres.slice(0, 6) });
        }
        return { proximosDias: resumen, hoy: today };
      },
    }),

    crear_reserva: tool({
      description:
        "Crea una reserva REAL en la agenda del negocio. Solo llamar cuando ya tengas: servicio, fecha, hora (validada con consultar_disponibilidad), nombre y teléfono del cliente. Nunca inventes datos.",
      inputSchema: z.object({
        servicio: z.string().min(2).max(120).describe("Servicio pedido por el cliente, idealmente uno de los del negocio."),
        fecha: z.string().regex(DATE_RE).describe("Fecha YYYY-MM-DD."),
        hora: z.string().regex(/^\d{2}:\d{2}$/).describe("Hora HH:mm, una de las disponibles."),
        nombre: z.string().min(2).max(120).describe("Nombre del cliente."),
        telefono: z.string().min(6).max(20).describe("Teléfono del cliente (ej. +56 9 1234 5678)."),
      }),
      execute: async ({ servicio, fecha, hora, nombre, telefono }) => {
        const service = matchService(servicio) ?? servicio;
        const result = await createBookingAndNotify({
          service,
          date: fecha,
          time: hora,
          name: nombre,
          phone: telefono,
        });
        if (!result.ok || !result.booking) return { error: result.error ?? "No se pudo crear la reserva." };
        return {
          ok: true,
          reserva: {
            id: result.booking.id,
            servicio: result.booking.service,
            fecha: result.booking.date,
            dia: dayLabel(result.booking.date),
            hora: result.booking.time,
            estado: result.booking.status,
          },
          requiereAutorizacion:
            result.booking.status === "pendiente_autorizacion"
              ? "Ese día ya está en su tope de horas — avísale al cliente que su reserva quedó a la espera de que el negocio la autorice, no ofrezcas pagar el abono todavía."
              : undefined,
          abono: clientConfig.booking?.depositAmount
            ? {
                monto: clientConfig.booking.depositAmount,
                nota:
                  result.depositNote ??
                  "La reserva queda pendiente hasta pagar el abono; también se puede pagar con tarjeta en la página /agenda.",
              }
            : null,
        };
      },
    }),
  };
}
