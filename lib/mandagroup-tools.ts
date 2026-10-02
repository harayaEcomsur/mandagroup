import { tool, type ToolSet } from "ai";
import { z } from "zod";
import { clientConfig } from "@/config/client.config";
import { buildWhatsAppLink } from "@/lib/whatsapp";
import { getReservationNumber, listActiveEvents, logDerivation, type Canal, type InstagramScope } from "@/lib/mandagroup-store";

// Tools de derivación del módulo "eventos" (reemplazo de ManyChat): el
// asistente nunca inventa un número ni un link — siempre los lee en vivo desde
// la base (editables en /eventos/admin) y registra la derivación para las
// estadísticas del panel. `canal` lo fija cada webhook al construir el tool
// set (ver app/api/whatsapp, app/api/instagram, app/api/chat).

const VENUE_LABEL = { renaca: "Manda Reñaca", vina: "Manda Viña del Mar" } as const;

// "viernes 16 de octubre" — para que el modelo no tenga que interpretar un
// "YYYY-MM-DD" a ojo al hablarle al cliente.
function formatEventDate(iso: string): string {
  return new Date(iso + "T12:00:00").toLocaleDateString("es-CL", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

// `userMessage` es el mensaje del cliente en este turno — se guarda junto a la
// derivación para que el panel muestre qué preguntó, no solo un conteo.
// `scope` acota lo que puede ofrecer una cuenta de Instagram puntual (ver
// InstagramScope) — `undefined` (WhatsApp, chat del sitio, o una cuenta de
// Instagram sin restricción configurada) significa sin acotar, igual que
// siempre. Se filtra en 2 niveles: listar_eventos_activos nunca muestra un
// evento fuera de scope (así el modelo ni se entera de que existe) y
// derivar_reserva se omite por completo si allowReservations es false — no
// basta con pedírselo en el prompt, un modelo "lite" puede igual ofrecerla.
export function buildMandagroupTools(canal: Canal, userMessage?: string, scope?: InstagramScope): ToolSet {
  if (!clientConfig.modules.eventos) return {};

  const allowedVenues = scope?.venues;
  const allowReservations = scope?.allowReservations ?? true;

  const tools: ToolSet = {
    listar_eventos_activos: tool({
      description:
        "Devuelve los eventos/fiestas activos DE HOY EN ADELANTE (los de fechas pasadas ya no aparecen solos), con su fecha real, local y link de entradas. Vienen ordenados por fecha — el primero de la lista es siempre la próxima fiesta. Úsala SIEMPRE antes de derivar a una invitación/entrada, y también cuando pregunten 'cuál es la próxima fiesta' o por eventos de semanas más adelante — nunca asumas cuáles hay ni cuál es el más próximo por tu cuenta.",
      inputSchema: z.object({}),
      execute: async () => {
        const events = (await listActiveEvents()).filter((e) => !allowedVenues || allowedVenues.includes(e.venue));
        if (!events.length) {
          return { eventos: [], nota: "No hay eventos activos cargados ahora mismo — indícalo al cliente y ofrece derivar por WhatsApp." };
        }
        return {
          eventos: events.map((e, i) => ({
            id: e.id,
            local: VENUE_LABEL[e.venue],
            titulo: e.title,
            fecha: formatEventDate(e.eventDate),
            es_la_mas_proxima: i === 0,
          })),
        };
      },
    }),

    derivar_invitacion: tool({
      description:
        "Confirma un evento (de los que devolvió listar_eventos_activos) y entrega el link real de compra de entradas. Solo llamar con un event_id que la tool anterior haya devuelto — nunca inventes un id.",
      inputSchema: z.object({
        event_id: z.string().describe("id del evento, tal como lo devolvió listar_eventos_activos"),
      }),
      execute: async ({ event_id }) => {
        const events = await listActiveEvents();
        const event = events.find((e) => e.id === event_id);
        if (!event || (allowedVenues && !allowedVenues.includes(event.venue))) {
          return { error: "Ese evento ya no está activo — vuelve a llamar listar_eventos_activos para ver las opciones vigentes." };
        }
        logDerivation({ canal, tipo: "invitacion", venue: event.venue, eventId: event.id, eventTitle: event.title, userMessage });
        return {
          local: VENUE_LABEL[event.venue],
          titulo: event.title,
          fecha: formatEventDate(event.eventDate),
          link_entradas: event.ticketUrl,
        };
      },
    }),
  };

  if (!allowReservations) return tools;

  tools.derivar_reserva = tool({
    description:
      "Entrega el WhatsApp vigente para coordinar una reserva de mesa/lista en un local. Llamar cuando el cliente pida reservar (no comprar entrada).",
    inputSchema: z.object({
      venue: z.enum(["renaca", "vina"]).describe("En qué local quiere reservar."),
    }),
    execute: async ({ venue }) => {
      if (allowedVenues && !allowedVenues.includes(venue)) {
        return { error: "Las reservas de ese local no se coordinan por este canal — ofrece el WhatsApp general o la cuenta de Instagram de ese local." };
      }
      const phone = await getReservationNumber();
      if (!phone) {
        return { error: "Aún no hay un número de reservas configurado — dile al cliente que un anfitrión lo contactará a la brevedad." };
      }
      logDerivation({ canal, tipo: "reserva", venue, userMessage });
      return {
        local: VENUE_LABEL[venue],
        whatsapp_link: buildWhatsAppLink(phone, `Hola! Quiero reservar en ${VENUE_LABEL[venue]}`),
      };
    },
  });

  return tools;
}
