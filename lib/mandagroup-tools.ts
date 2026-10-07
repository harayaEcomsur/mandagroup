import { tool, type ToolSet } from "ai";
import { z } from "zod";
import { clientConfig } from "@/config/client.config";
import { listActiveEvents, logDerivation, type Canal, type EventVenue, type InstagramScope } from "@/lib/mandagroup-store";
import { eventVenueLabel } from "@/lib/mandagroup-brands";
import { listLocales, reservationLink } from "@/lib/mandagroup-catalog";

// Tools de derivación del módulo "eventos" (reemplazo de ManyChat): el
// asistente nunca inventa un número ni un link — siempre los lee en vivo desde
// la base (editables en /eventos/admin) y registra la derivación para las
// estadísticas del panel. `canal` lo fija cada webhook al construir el tool
// set (ver app/api/whatsapp, app/api/instagram, app/api/chat).


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
// "Viña del Mar" → "vina del mar" (sin tildes ni mayúsculas, para comparar).
function normalize(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

export function buildMandagroupTools(canal: Canal, userMessage?: string, scope?: InstagramScope): ToolSet {
  if (!clientConfig.modules.eventos) return {};

  const allowedVenues = scope?.venues;
  // Sin scope: todo (los 2 locales y Costa Nights). Con scope: solo los
  // locales de esa cuenta — una cuenta acotada a un local no ofrece las
  // fiestas Costa Nights en recintos externos.
  const isAllowed = (venue: EventVenue) => !allowedVenues || (allowedVenues as EventVenue[]).includes(venue);
  const allowReservations = scope?.allowReservations ?? true;

  const tools: ToolSet = {
    listar_eventos_activos: tool({
      description:
        "Devuelve los eventos/fiestas activos DE HOY EN ADELANTE (los de fechas pasadas ya no aparecen solos), con su fecha real, local y link de entradas. Vienen ordenados por fecha — el primero de la lista es siempre la próxima fiesta. Úsala SIEMPRE antes de derivar a una invitación/entrada, y también cuando pregunten 'cuál es la próxima fiesta' o por eventos de semanas más adelante — nunca asumas cuáles hay ni cuál es el más próximo por tu cuenta.",
      inputSchema: z.object({}),
      execute: async () => {
        const events = (await listActiveEvents()).filter((e) => isAllowed(e.venue));
        if (!events.length) {
          return { eventos: [], nota: "No hay eventos activos cargados ahora mismo — indícalo al cliente y ofrece derivar por WhatsApp." };
        }
        return {
          eventos: events.map((e, i) => ({
            id: e.id,
            local: eventVenueLabel(e),
            titulo: e.title,
            fecha: formatEventDate(e.eventDate),
            es_la_mas_proxima: i === 0,
            // Detalle real de Vesti cuando existe (dirección del recinto,
            // precio desde, agotado) para que responda "¿dónde es?" o
            // "¿cuánto cuesta?" sin inventar.
            ...(e.address ? { direccion: e.address } : {}),
            ...(e.lowestPrice ? { precio_desde_clp: e.lowestPrice } : {}),
            ...(e.soldOut ? { agotado: true } : {}),
          })),
        };
      },
    }),

    ...(canal === "instagram"
      ? {
          // Solo Instagram sabe mandar un adjunto de imagen aparte (ver
          // app/api/instagram/route.ts) — en web/WhatsApp esta tool no se
          // ofrece para que el modelo no "ofrezca" una imagen que no se envía.
          enviar_dresscode: tool({
            description:
              "Envía la imagen REAL con las reglas de dress code/vestimenta de la fiesta. Úsala cuando pregunten qué se puede o no usar para entrar, o por el dress code en general — además de la imagen, resume brevemente las reglas en tu respuesta de texto.",
            inputSchema: z.object({}),
            execute: async () => {
              // Meta tiene que poder bajar esta imagen desde su servidor, así
              // que va fija al dominio *.vercel.app (siempre apunta al deploy
              // vigente) y no a NEXT_PUBLIC_SITE_URL — mandagroup.cl todavía
              // apunta al hosting viejo (cPanel/WP), no a este proyecto.
              return { image_url: "https://mandagroup.vercel.app/clients/mandagroup/dresscode.jpg" };
            },
          }),
        }
      : {}),

    derivar_invitacion: tool({
      description:
        "Confirma un evento (de los que devolvió listar_eventos_activos) y entrega el link real de compra de entradas. Solo llamar con un event_id que la tool anterior haya devuelto — nunca inventes un id.",
      inputSchema: z.object({
        event_id: z.string().describe("id del evento, tal como lo devolvió listar_eventos_activos"),
      }),
      execute: async ({ event_id }) => {
        const events = await listActiveEvents();
        const event = events.find((e) => e.id === event_id);
        if (!event || !isAllowed(event.venue)) {
          return { error: "Ese evento ya no está activo — vuelve a llamar listar_eventos_activos para ver las opciones vigentes." };
        }
        logDerivation({ canal, tipo: "invitacion", venue: event.venue, eventId: event.id, eventTitle: event.title, userMessage });
        return {
          local: eventVenueLabel(event),
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
      "Entrega el canal real para reservar mesa en un local del grupo (cada local tiene el suyo: WhatsApp de reservas, Instagram o un link; se administran en el panel). Llamar cuando el cliente pida reservar (no comprar entrada). Si no sabes en qué local, pregúntale. Nunca ofrezcas el WhatsApp de consultas para reservar.",
    inputSchema: z.object({
      local: z
        .string()
        .describe("Local donde quiere reservar, como lo dijo el cliente (ej. 'Manda Reñaca', 'Viña', 'Costa Sushi Curauma')."),
    }),
    execute: async ({ local }) => {
      const locales = (await listLocales()).filter((l) => l.showOnSite);
      const q = normalize(local);
      // Coincidencia por nombre o id; "reñaca" / "viña" a secas apuntan a Manda.
      const match =
        locales.find((l) => normalize(l.name) === q || l.id === q) ??
        locales.find((l) => normalize(l.name).includes(q)) ??
        locales.find((l) => l.brand === "manda" && q.split(" ").some((w) => w.length > 3 && normalize(l.name).includes(w)));
      const opciones = locales.filter((l) => reservationLink(l)).map((l) => l.name);
      if (!match) {
        return { error: "No reconocí el local. Pregúntale cuál de estos prefiere.", locales_con_reserva: opciones };
      }
      const venue = match.id === "manda-renaca" ? "renaca" : match.id === "manda-vina" ? "vina" : undefined;
      if (venue && allowedVenues && !allowedVenues.includes(venue)) {
        return { error: "Las reservas de ese local no se coordinan por este canal — ofrece la cuenta de Instagram de ese local." };
      }
      const link = reservationLink(match);
      logDerivation({ canal, tipo: "reserva", venue, userMessage });
      if (!link) {
        return {
          local: match.name,
          error: "Este local no toma reservas online. Dile que puede escribir por el WhatsApp de consultas o acercarse al local.",
          locales_con_reserva: opciones,
        };
      }
      if (match.reservation.type === "instagram") {
        const handle = match.reservation.handle.replace(/^@/, "");
        return {
          local: match.name,
          canal_reserva: "instagram",
          instagram_link: link.href,
          nota:
            canal === "instagram"
              ? `Las reservas de ${match.name} se coordinan por Instagram. Si esta conversación es con @${handle}, pídele que escriba aquí mismo fecha, cantidad de personas y nombre; si es otra cuenta, entrégale el link de @${handle}.`
              : `Las reservas de ${match.name} se coordinan solo por Instagram: entrégale el link para escribirle a @${handle}.`,
        };
      }
      return match.reservation.type === "whatsapp"
        ? { local: match.name, canal_reserva: "whatsapp", whatsapp_link: link.href }
        : { local: match.name, canal_reserva: "link", reserva_link: link.href };
    },
  });

  return tools;
}
