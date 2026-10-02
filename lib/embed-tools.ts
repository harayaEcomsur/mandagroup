import { tool, type ToolSet } from "ai";
import { z } from "zod";
import { notifyByEmail, notifyByWhatsApp } from "@/lib/booking-actions";
import { buildWhatsAppLink } from "@/lib/whatsapp";
import { slotsForDate, createBooking, type EmbedBooking } from "@/lib/embed-agenda";
import { dentalinkTokenFor, listarDisponibilidad, buscarOCrearPaciente, crearCita } from "@/lib/embed-dentalink";
import {
  agendaProTokenFor,
  listarDisponibilidad as listarDisponibilidadAP,
  buscarOCrearCliente as buscarOCrearClienteAP,
  crearReserva as crearReservaAP,
} from "@/lib/embed-agendapro";
import { createOrder } from "@/lib/embed-store";
import { embedWebpayEnv } from "@/lib/embed-webpay";
import { createTransaction } from "@/lib/webpay";
import { searchShopifyProducts, getShopifyProduct } from "@/lib/embed-shopify";
import type { EmbedTenant } from "@/config/embed-tenants";

// Tools TRANSACCIONALES del asistente EMBEBIBLE, resueltas por tenant.
//
// Primer slice: captura de contacto/lead universal (sirve a cualquier rubro —
// salón, abogado, tienda), que avisa al dueño DEL TENANT por email y, si hay
// token de la app de Meta de HarayaDev, también por WhatsApp (enviado desde el
// número de HarayaDev al número del dueño, no del tenant). Es aditivo: no toca
// el store single-tenant ni la agenda/tienda compartidas, y no necesita secretos
// por tenant. La agenda y la tienda por tenant (con verdad de servidor y
// aislamiento de secretos de Webpay/WhatsApp propios) son el siguiente slice.

interface ContactoData {
  nombre: string;
  telefono: string;
  interes: string;
  email?: string;
}

// Resumen legible para el aviso al dueño — mismo estilo que leadSummary/bookingSummary.
function contactoSummary(t: EmbedTenant, data: ContactoData): string {
  const lines = [
    `Nuevo CONTACTO desde el asistente de ${t.businessName}:`,
    ``,
    `Nombre: ${data.nombre}`,
    `Teléfono: ${data.telefono}`,
  ];
  if (data.email) lines.push(`Email: ${data.email}`);
  lines.push(``, `Consulta: ${data.interes}`);
  return lines.join("\n");
}

// Cuerpo del email: resumen + link wa.me para escribirle de vuelta al interesado.
function contactoEmailBody(t: EmbedTenant, data: ContactoData, summary: string): string {
  const lines = [summary];
  if (data.telefono.replace(/\D/g, "").length >= 8) {
    lines.push(
      ``,
      `💬 Escribirle por WhatsApp:`,
      buildWhatsAppLink(data.telefono, `Hola ${data.nombre}! Te escribo de ${t.businessName} 😊`)
    );
  }
  return lines.join("\n");
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function todayISO(): string {
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
// Calza lo que escribió la persona con un servicio del tenant (sin tildes/mayúsculas).
function matchService(t: EmbedTenant, input: string): string | null {
  const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const wanted = norm(input);
  const titles = t.agenda?.services ?? [];
  return (
    titles.find((x) => norm(x) === wanted) ??
    titles.find((x) => norm(x).includes(wanted) || wanted.includes(norm(x))) ??
    null
  );
}

async function notifyOwnerBooking(t: EmbedTenant, b: EmbedBooking): Promise<void> {
  const summary = [
    `Nueva RESERVA desde el asistente de ${t.businessName}:`,
    ``,
    `Servicio: ${b.service}`,
    `Fecha: ${b.date} (${dayLabel(b.date)}) a las ${b.time}`,
    `Cliente: ${b.name} · ${b.phone} (reserva ${b.id})`,
  ].join("\n");
  const emailBody =
    b.phone.replace(/\D/g, "").length >= 8
      ? `${summary}\n\n💬 Escribirle por WhatsApp:\n${buildWhatsAppLink(
          b.phone,
          `Hola ${b.name}! Te escribo de ${t.businessName} por tu reserva 😊`
        )}`
      : summary;
  await Promise.all([
    notifyByEmail(`📅 Nueva reserva ${b.id} — ${t.businessName}`, emailBody, t.ownerNotifyEmail, process.env.EMBED_NOTIFY_CC),
    t.whatsapp && process.env.NOTIFY_WA_TOKEN
      ? notifyByWhatsApp(t.whatsapp, summary)
      : Promise.resolve(false),
  ]);
}

// Tools de agenda por tenant: solo se exponen si el tenant declaró `agenda`.
// La disponibilidad sale del motor (embed-agenda), nunca de lo que "cree" el
// modelo — mismo principio que la agenda del sitio.
function buildEmbedAgendaTools(t: EmbedTenant): ToolSet {
  if (!t.agenda) return {};
  const daysAhead = t.agenda.daysAhead ?? 14;

  return {
    consultar_disponibilidad: tool({
      description:
        "Consulta los horarios REALMENTE disponibles. Sin fecha: resume los próximos días con horas libres. Con fecha (YYYY-MM-DD): lista las horas libres de ese día. Úsala SIEMPRE antes de ofrecer un horario; nunca inventes horas.",
      inputSchema: z.object({
        fecha: z
          .string()
          .regex(DATE_RE)
          .optional()
          .describe("Fecha exacta YYYY-MM-DD. Omitir para el resumen de próximos días."),
      }),
      execute: async ({ fecha }) => {
        const today = todayISO();
        if (fecha) {
          if (fecha < today) return { error: "Esa fecha ya pasó." };
          if (fecha > addDays(today, daysAhead))
            return { error: `Solo se puede reservar hasta ${daysAhead} días hacia adelante.` };
          const libres = (await slotsForDate(t, fecha)).filter((s) => s.available).map((s) => s.time);
          return { fecha, dia: dayLabel(fecha), horasDisponibles: libres, sinAtencion: libres.length === 0 };
        }
        const resumen: { fecha: string; dia: string; horasDisponibles: string[] }[] = [];
        for (let i = 1; i <= daysAhead && resumen.length < 5; i++) {
          const d = addDays(today, i);
          const libres = (await slotsForDate(t, d)).filter((s) => s.available).map((s) => s.time);
          if (libres.length > 0) resumen.push({ fecha: d, dia: dayLabel(d), horasDisponibles: libres.slice(0, 6) });
        }
        return { proximosDias: resumen, hoy: today, servicios: t.agenda?.services ?? [] };
      },
    }),

    crear_reserva: tool({
      description:
        "Crea una reserva REAL en la agenda. Llámala de inmediato en cuanto tengas los 5 datos: servicio, fecha (YYYY-MM-DD), hora (HH:mm), nombre y teléfono del cliente. NO necesitas haber llamado antes a consultar_disponibilidad ni pedir confirmaciones extra: el sistema valida la disponibilidad en el servidor y te avisa si la hora no está libre. Nunca inventes datos; úsalos tal como los dio el cliente.",
      inputSchema: z.object({
        servicio: z.string().min(2).max(120).describe("Servicio pedido, idealmente uno de los del negocio."),
        fecha: z.string().regex(DATE_RE).describe("Fecha YYYY-MM-DD."),
        hora: z.string().regex(/^\d{2}:\d{2}$/).describe("Hora HH:mm, una de las disponibles."),
        nombre: z.string().min(2).max(120).describe("Nombre del cliente."),
        telefono: z.string().min(6).max(25).describe("Teléfono del cliente."),
      }),
      execute: async ({ servicio, fecha, hora, nombre, telefono }) => {
        const service = matchService(t, servicio) ?? servicio;
        const result = await createBooking(t, { service, date: fecha, time: hora, name: nombre, phone: telefono });
        if ("error" in result) return { error: result.error };
        await notifyOwnerBooking(t, result);
        return {
          ok: true,
          reserva: {
            id: result.id,
            servicio: result.service,
            fecha: result.date,
            dia: dayLabel(result.date),
            hora: result.time,
            estado: result.status,
          },
        };
      },
    }),
  };
}

// Agenda EXTERNA (Dentalink): mismos nombres de tool que buildEmbedAgendaTools
// (consultar_disponibilidad, crear_reserva) para que las instrucciones del
// prompt (embed-tenants.ts#buildEmbedSystemPrompt) sirvan para ambos motores
// sin duplicar texto — la diferencia es que acá la disponibilidad y la
// reserva son llamadas reales a la cuenta de Dentalink del cliente, no a
// nuestra base de datos. Sin DENTALINK_TOKEN_<ID> configurado, no se activan
// (el tenant queda sin agenda conversacional, solo deriva).
function buildDentalinkAgendaTools(t: EmbedTenant): ToolSet {
  if (t.externalAgenda?.provider !== "dentalink") return {};
  const token = dentalinkTokenFor(t);
  if (!token) return {};
  const daysAhead = 14;

  return {
    consultar_disponibilidad: tool({
      description:
        "Consulta los horarios REALMENTE disponibles en Dentalink. Sin fecha: resume los próximos días con horas libres. Con fecha (YYYY-MM-DD): lista las horas libres de ese día. Úsala SIEMPRE antes de ofrecer un horario; nunca inventes horas.",
      inputSchema: z.object({
        fecha: z
          .string()
          .regex(DATE_RE)
          .optional()
          .describe("Fecha exacta YYYY-MM-DD. Omitir para el resumen de próximos días."),
      }),
      execute: async ({ fecha }) => {
        const today = todayISO();
        try {
          if (fecha) {
            if (fecha < today) return { error: "Esa fecha ya pasó." };
            if (fecha > addDays(today, daysAhead))
              return { error: `Solo se puede reservar hasta ${daysAhead} días hacia adelante.` };
            const libres = await listarDisponibilidad(t, token, fecha);
            return {
              fecha,
              dia: dayLabel(fecha),
              horasDisponibles: libres.map((s) => s.hora_inicio.slice(0, 5)),
              sinAtencion: libres.length === 0,
            };
          }
          const resumen: { fecha: string; dia: string; horasDisponibles: string[] }[] = [];
          for (let i = 1; i <= daysAhead && resumen.length < 5; i++) {
            const d = addDays(today, i);
            const libres = await listarDisponibilidad(t, token, d);
            if (libres.length > 0)
              resumen.push({ fecha: d, dia: dayLabel(d), horasDisponibles: libres.slice(0, 6).map((s) => s.hora_inicio.slice(0, 5)) });
          }
          return { proximosDias: resumen, hoy: today };
        } catch (e) {
          console.error(`[embed-dentalink] consultar_disponibilidad (${t.id}):`, e);
          return { error: "No pudimos consultar la agenda ahora. Ofrece derivar por WhatsApp." };
        }
      },
    }),

    crear_reserva: tool({
      description:
        "Crea una reserva REAL en Dentalink. Llámala de inmediato en cuanto tengas los 4 datos: fecha (YYYY-MM-DD), hora (HH:mm) YA CONFIRMADA como disponible por consultar_disponibilidad, nombre completo y teléfono del cliente. NO pidas confirmaciones extra. Si crear_reserva devuelve error, ofrece otro horario. NUNCA digas que una hora quedó reservada sin que esta tool haya respondido ok.",
      inputSchema: z.object({
        servicio: z.string().min(2).max(120).optional().describe("Qué motiva la visita, si lo mencionó (queda como comentario de la cita)."),
        fecha: z.string().regex(DATE_RE).describe("Fecha YYYY-MM-DD."),
        hora: z.string().regex(/^\d{2}:\d{2}$/).describe("Hora HH:mm, una de las que devolvió consultar_disponibilidad."),
        nombre: z.string().min(2).max(120).describe("Nombre completo del cliente, tal como lo dio."),
        telefono: z.string().min(6).max(25).describe("Teléfono del cliente."),
      }),
      execute: async ({ servicio, fecha, hora, nombre, telefono }) => {
        try {
          const libres = await listarDisponibilidad(t, token, fecha);
          const slot = libres.find((s) => s.hora_inicio.slice(0, 5) === hora);
          if (!slot) return { error: "Esa hora ya no está disponible. Consulta de nuevo la disponibilidad." };

          const paciente = await buscarOCrearPaciente(token, { nombreCompleto: nombre, telefono });
          const cita = await crearCita(t, token, {
            idPaciente: paciente.id,
            idDentista: slot.id_dentista,
            idSillon: slot.id_recurso,
            fecha,
            horaInicio: hora,
            comentario: servicio,
          });

          await Promise.all([
            notifyByEmail(
              `📅 Nueva reserva (Dentalink) — ${t.businessName}`,
              `Nueva RESERVA desde el asistente de ${t.businessName}:\n\nFecha: ${fecha} (${dayLabel(fecha)}) a las ${hora}\nProfesional: ${slot.nombre_dentista}\nCliente: ${nombre} · ${telefono}\nCita Dentalink #${cita.id}`,
              t.ownerNotifyEmail,
              process.env.EMBED_NOTIFY_CC
            ),
            t.whatsapp && process.env.NOTIFY_WA_TOKEN
              ? notifyByWhatsApp(t.whatsapp, `Nueva reserva Dentalink: ${nombre} (${telefono}) — ${dayLabel(fecha)} ${hora} con ${slot.nombre_dentista}.`)
              : Promise.resolve(false),
          ]);

          return {
            ok: true,
            reserva: {
              id: cita.id,
              fecha,
              dia: dayLabel(fecha),
              hora,
              profesional: slot.nombre_dentista,
              estado: cita.estado_cita,
            },
          };
        } catch (e) {
          console.error(`[embed-dentalink] crear_reserva (${t.id}):`, e);
          return { error: "No pudimos crear la reserva en Dentalink ahora. Ofrece derivar por WhatsApp." };
        }
      },
    }),
  };
}

// Agenda EXTERNA (AgendaPro): mismos nombres de tool que las otras dos agendas
// por la misma razón — el prompt de embed-tenants.ts no distingue backend.
function buildAgendaProAgendaTools(t: EmbedTenant): ToolSet {
  if (t.externalAgenda?.provider !== "agendapro") return {};
  const token = agendaProTokenFor(t);
  if (!token) return {};
  const daysAhead = 14;

  return {
    consultar_disponibilidad: tool({
      description:
        "Consulta los horarios REALMENTE disponibles en AgendaPro. Sin fecha: resume los próximos días con horas libres. Con fecha (YYYY-MM-DD): lista las horas libres de ese día. Úsala SIEMPRE antes de ofrecer un horario; nunca inventes horas.",
      inputSchema: z.object({
        fecha: z
          .string()
          .regex(DATE_RE)
          .optional()
          .describe("Fecha exacta YYYY-MM-DD. Omitir para el resumen de próximos días."),
      }),
      execute: async ({ fecha }) => {
        const today = todayISO();
        try {
          if (fecha) {
            if (fecha < today) return { error: "Esa fecha ya pasó." };
            if (fecha > addDays(today, daysAhead))
              return { error: `Solo se puede reservar hasta ${daysAhead} días hacia adelante.` };
            const libres = await listarDisponibilidadAP(t, token, fecha);
            return {
              fecha,
              dia: dayLabel(fecha),
              horasDisponibles: libres.map((s) => s.start_time.slice(0, 5)),
              sinAtencion: libres.length === 0,
            };
          }
          const resumen: { fecha: string; dia: string; horasDisponibles: string[] }[] = [];
          for (let i = 1; i <= daysAhead && resumen.length < 5; i++) {
            const d = addDays(today, i);
            const libres = await listarDisponibilidadAP(t, token, d);
            if (libres.length > 0)
              resumen.push({ fecha: d, dia: dayLabel(d), horasDisponibles: libres.slice(0, 6).map((s) => s.start_time.slice(0, 5)) });
          }
          return { proximosDias: resumen, hoy: today };
        } catch (e) {
          console.error(`[embed-agendapro] consultar_disponibilidad (${t.id}):`, e);
          return { error: "No pudimos consultar la agenda ahora. Ofrece derivar por WhatsApp." };
        }
      },
    }),

    crear_reserva: tool({
      description:
        "Crea una reserva REAL en AgendaPro. Llámala de inmediato en cuanto tengas los 4 datos: fecha (YYYY-MM-DD), hora (HH:mm) YA CONFIRMADA como disponible por consultar_disponibilidad, nombre completo y teléfono del cliente. NO pidas confirmaciones extra. Si crear_reserva devuelve error, ofrece otro horario. NUNCA digas que una hora quedó reservada sin que esta tool haya respondido ok.",
      inputSchema: z.object({
        servicio: z.string().min(2).max(120).optional().describe("Qué motiva la visita, si lo mencionó (queda como nota de la reserva)."),
        fecha: z.string().regex(DATE_RE).describe("Fecha YYYY-MM-DD."),
        hora: z.string().regex(/^\d{2}:\d{2}$/).describe("Hora HH:mm, una de las que devolvió consultar_disponibilidad."),
        nombre: z.string().min(2).max(120).describe("Nombre completo del cliente, tal como lo dio."),
        telefono: z.string().min(6).max(25).describe("Teléfono del cliente."),
      }),
      execute: async ({ servicio, fecha, hora, nombre, telefono }) => {
        try {
          const libres = await listarDisponibilidadAP(t, token, fecha);
          const slot = libres.find((s) => s.start_time.slice(0, 5) === hora);
          if (!slot) return { error: "Esa hora ya no está disponible. Consulta de nuevo la disponibilidad." };

          const cliente = await buscarOCrearClienteAP(token, { nombreCompleto: nombre, telefono });
          const reserva = await crearReservaAP(t, token, {
            clientId: cliente.id,
            providerId: slot.provider_id,
            fecha,
            horaInicio: hora,
            comentario: servicio,
          });

          await Promise.all([
            notifyByEmail(
              `📅 Nueva reserva (AgendaPro) — ${t.businessName}`,
              `Nueva RESERVA desde el asistente de ${t.businessName}:\n\nFecha: ${fecha} (${dayLabel(fecha)}) a las ${hora}\nProfesional: ${slot.provider_name}\nCliente: ${nombre} · ${telefono}\nReserva AgendaPro #${reserva.id}`,
              t.ownerNotifyEmail,
              process.env.EMBED_NOTIFY_CC
            ),
            t.whatsapp && process.env.NOTIFY_WA_TOKEN
              ? notifyByWhatsApp(t.whatsapp, `Nueva reserva AgendaPro: ${nombre} (${telefono}) — ${dayLabel(fecha)} ${hora} con ${slot.provider_name}.`)
              : Promise.resolve(false),
          ]);

          return {
            ok: true,
            reserva: {
              id: reserva.id,
              fecha,
              dia: dayLabel(fecha),
              hora,
              profesional: slot.provider_name,
              estado: reserva.status.name,
            },
          };
        } catch (e) {
          console.error(`[embed-agendapro] crear_reserva (${t.id}):`, e);
          return { error: "No pudimos crear la reserva en AgendaPro ahora. Ofrece derivar por WhatsApp." };
        }
      },
    }),
  };
}

// Tools de tienda por tenant: solo si el tenant declaró `store` con productos
// disponibles. Precios y total SIEMPRE del servidor; Webpay con las credenciales
// del tenant (aislamiento de la plata) y retorno namespaced por tenant.
function buildEmbedStoreTools(t: EmbedTenant): ToolSet {
  const available = t.store?.products.filter((p) => p.available !== false) ?? [];
  if (!t.store || available.length === 0) return {};

  const catalog = new Map(available.map((p) => [p.slug, p]));
  const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const similar = (wanted: string): string[] => {
    const w = norm(wanted);
    const words = w.split(/[^a-z0-9]+/).filter((p) => p.length >= 3);
    return [...catalog.keys()].filter((slug) => {
      const s = norm(slug);
      return s.includes(w) || w.includes(s) || words.some((p) => s.includes(p));
    });
  };
  const clp = (n: number) => "$" + n.toLocaleString("es-CL");

  return {
    crear_pedido: tool({
      description:
        "Crea un pedido REAL de la tienda y entrega el link de pago Webpay. Solo llamar cuando el cliente ya eligió productos y cantidades y entregó nombre y teléfono. Nunca inventes productos ni precios: usa únicamente slugs del catálogo.",
      inputSchema: z.object({
        items: z
          .array(
            z.object({
              slug: z.string().describe("Slug exacto del producto en el catálogo."),
              cantidad: z.number().int().positive().max(99).describe("Cantidad de unidades."),
            })
          )
          .min(1),
        nombre: z.string().min(2).max(120).describe("Nombre del cliente."),
        telefono: z.string().min(6).max(30).describe("Teléfono del cliente."),
        email: z.string().email().optional().describe("Email del cliente, si lo entregó."),
      }),
      execute: async ({ items, nombre, telefono, email }) => {
        const resolved: { slug: string; name: string; price: number; qty: number }[] = [];
        for (const { slug, cantidad } of items) {
          const product = catalog.get(slug);
          if (!product) {
            const parecidos = similar(slug);
            return {
              error:
                `El producto "${slug}" no existe o no está disponible.` +
                (parecidos.length > 0 ? ` ¿Quisiste decir: ${parecidos.join(", ")}?` : ""),
              slugsValidos: [...catalog.keys()],
            };
          }
          resolved.push({ slug, name: product.name, price: product.price, qty: cantidad });
        }

        const order = await createOrder(t, {
          items: resolved,
          buyer: { name: nombre, phone: telefono, email: email || undefined },
        });

        const origin = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
        try {
          const tx = await createTransaction(
            {
              buyOrder: order.id,
              sessionId: order.id,
              amount: order.total,
              returnUrl: `${origin}/api/embed/checkout/retorno?t=${encodeURIComponent(t.id)}`,
            },
            embedWebpayEnv(t)
          );
          return {
            ok: true,
            pedidoId: order.id,
            total: order.total,
            totalFormateado: clp(order.total),
            linkPago: `${tx.url}?token_ws=${encodeURIComponent(tx.token)}`,
            resumen: resolved.map((i) => ({ producto: i.name, cantidad: i.qty, subtotal: clp(i.price * i.qty) })),
            nota: t.store?.shippingNote,
          };
        } catch (e) {
          console.error("[embed-tools] Webpay create:", e);
          return {
            error:
              "No pudimos conectar con Webpay para generar el link de pago. Pide al cliente intentar de nuevo en unos minutos.",
          };
        }
      },
    }),
  };
}

// Concierge de tienda Shopify real (ver lib/embed-shopify.ts). La búsqueda la
// resuelve el servidor (mismo patrón que consultar_disponibilidad); agregar al
// carrito NO puede resolverse acá — el carrito vive en una cookie del
// navegador de la visita — así que la tool solo valida el producto/variante y
// devuelve un botón (sentinel `{{cart-add:...}}`) que el widget convierte en
// un botón real que ejecuta /cart/add.js en el propio sitio del cliente.
function buildShopifyTools(t: EmbedTenant): ToolSet {
  if (!t.shopify) return {};
  const domain = t.shopify.domain;
  const clp = (n: number) => "$" + n.toLocaleString("es-CL");

  return {
    buscar_productos: tool({
      description:
        "Busca productos REALES en el catálogo en vivo de la tienda (precio y stock actuales). Úsala siempre antes de recomendar o agregar un producto — nunca inventes nombres, precios ni disponibilidad.",
      inputSchema: z.object({
        consulta: z
          .string()
          .min(2)
          .max(120)
          .describe("Qué busca la persona, en sus palabras (ej. 'juguete para perro chico', 'crema para piel sensible')."),
      }),
      execute: async ({ consulta }) => {
        try {
          const productos = await searchShopifyProducts(domain, consulta);
          if (productos.length === 0) {
            return { productos: [], nota: "Sin resultados para esa búsqueda — prueba con otra palabra." };
          }
          return {
            productos: productos.map((p) => ({
              handle: p.handle,
              titulo: p.title,
              precio: clp(p.price),
              disponible: p.available,
            })),
          };
        } catch (e) {
          console.error("[embed-tools] buscar_productos:", e);
          return { error: "No pude conectar con el catálogo ahora mismo." };
        }
      },
    }),
    agregar_al_carrito: tool({
      description:
        'Prepara agregar un producto al carrito REAL de esta visita. Llamar SOLO con un handle devuelto por buscar_productos — nunca inventar uno. La respuesta trae un campo "boton" que debes incluir TAL CUAL en tu mensaje, en su propia línea.',
      inputSchema: z.object({
        handle: z.string().min(1).max(200).describe("Handle exacto del producto, tal como lo devolvió buscar_productos."),
        cantidad: z.number().int().positive().max(20).default(1),
        variante: z
          .string()
          .max(120)
          .optional()
          .describe("Título de la variante (talla/color) si el producto tiene más de una — pregúntala antes si no la sabes."),
      }),
      execute: async ({ handle, cantidad, variante }) => {
        try {
          const product = await getShopifyProduct(domain, handle);
          if (!product) {
            return { error: `No encontré el producto "${handle}". Usa buscar_productos de nuevo para confirmar el handle.` };
          }
          const variants = product.variants;
          const chosen = variante
            ? variants.find((v) => v.title.toLowerCase() === variante.toLowerCase())
            : variants.length === 1
              ? variants[0]
              : undefined;
          if (!chosen) {
            return {
              error: `"${product.title}" tiene varias opciones — pregunta cuál antes de agregar.`,
              variantesDisponibles: variants.map((v) => v.title),
            };
          }
          if (!chosen.available) {
            return { error: `"${product.title}" (${chosen.title}) está sin stock ahora mismo.` };
          }
          return {
            ok: true,
            titulo: product.title,
            precio: clp(chosen.price),
            boton: `{{cart-add:${chosen.id}:${cantidad}:${product.title}}}`,
          };
        } catch (e) {
          console.error("[embed-tools] agregar_al_carrito:", e);
          return { error: "No pude conectar con la tienda para agregar el producto." };
        }
      },
    }),
  };
}

// Concierge de tienda SIMULADO (ver `demoStore` en config/embed-tenants.ts):
// para prospectos cuya plataforma no expone ningún endpoint público
// reutilizable (verificado en vivo contra samsonite.com.mx/saxoline.cl — su
// "agregar al carrito" es un Server Action propio, no /cart/add.js). Busca en
// un catálogo curado a mano EN MEMORIA (nunca una API en vivo) y el botón de
// agregar al carrito es una confirmación simulada — el sentinel que emite acá
// (`{{cart-add-demo:...}}`) el widget lo pinta como un botón que confirma sin
// ejecutar ningún fetch real (a diferencia de `{{cart-add:...}}` de
// buildShopifyTools, que sí llama /cart/add.js de verdad).
function buildDemoStoreTools(t: EmbedTenant): ToolSet {
  if (!t.demoStore) return {};
  const products = t.demoStore.products;
  const clp = (n: number) => "$" + n.toLocaleString(t.demoStore!.priceLocale ?? "es-CL");

  return {
    buscar_productos_demo: tool({
      description:
        "Busca en el catálogo de ejemplo de este prospecto (nombres y precios reales de su sitio, pero es una demo — no es un catálogo en vivo). Úsala antes de recomendar o agregar un producto — SIEMPRE que la persona dé un presupuesto o monto, pásalo en precioMaximo (filtro real del servidor, no lo calcules tú de memoria).",
      inputSchema: z.object({
        consulta: z
          .string()
          .min(2)
          .max(120)
          .describe(
            "Tipo de producto y color si los mencionó, en sus palabras (ej. 'mochila negra', 'maleta grande azul'). Varias palabras clave está bien — cada una se busca por separado."
          ),
        precioMaximo: z
          .number()
          .int()
          .positive()
          .optional()
          .describe("Presupuesto máximo en la moneda local, SOLO si la persona dio un monto o rango (usa el tope superior del rango)."),
      }),
      execute: async ({ consulta, precioMaximo }) => {
        // Catálogo curado a mano con nombres tal como los publica el sitio —
        // mezclan español e inglés para el color (ej. "Black", "Marine
        // Blue") según el SKU real. Sin este mapeo, alguien que pide "azul"
        // no encuentra un producto que literalmente dice "Blue".
        const COLOR_ES: Record<string, string> = {
          black: "negra",
          blue: "azul",
          pink: "rosada",
          yellow: "amarilla",
          violet: "morada",
          purple: "morada",
          marine: "azul",
          green: "verde",
          white: "blanca",
          gray: "gris",
          grey: "gris",
        };
        const norm = (s: string) => {
          var x = s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
          for (var en in COLOR_ES) x = x.replace(new RegExp("\\b" + en + "\\b", "g"), COLOR_ES[en]);
          return x;
        };
        const words = norm(consulta)
          .split(/[^a-z0-9]+/)
          .filter((w) => w.length >= 3);
        const haystack = (p: (typeof products)[number]) => norm(p.name + " " + (p.description ?? ""));
        // AND, no OR: con 2+ palabras clave (típicamente tipo + color) exige
        // que TODAS aparezcan, para no devolver una maleta rosada cuando
        // piden "maleta negra". Si el AND no encuentra nada y había más de
        // una palabra, relaja a OR — mejor una lista amplia que ninguna.
        let candidates = words.length > 0 ? products.filter((p) => words.every((w) => haystack(p).includes(w))) : products.slice();
        if (candidates.length === 0 && words.length > 1) {
          candidates = products.filter((p) => words.some((w) => haystack(p).includes(w)));
        }
        if (precioMaximo) candidates = candidates.filter((p) => p.price <= precioMaximo);

        if (candidates.length === 0) {
          return {
            productos: [],
            nota: precioMaximo
              ? `No hay nada de ese tipo bajo ${clp(precioMaximo)} en el catálogo de ejemplo. Ofrece la opción más económica que encuentres buscando sin precioMaximo, o pregunta si puede subir el presupuesto.`
              : "Sin resultados para esa búsqueda en el catálogo de ejemplo — prueba con otra palabra (tipo de producto o color).",
          };
        }
        return {
          productos: candidates.slice(0, 6).map((p) => ({
            nombre: p.name,
            precio: clp(p.price),
            descripcion: p.description,
            imagenUrl: p.imageUrl,
            link: p.url,
          })),
          nota: "Catálogo de ejemplo para esta demo (no en vivo). Recomienda UN producto específico de esta lista según lo que pidió — no los listes todos genéricamente. Si el producto trae imagenUrl, inclúyela en tu respuesta como imagen markdown.",
        };
      },
    }),
    agregar_al_carrito_demo: tool({
      description:
        'Simula agregar un producto al carrito, SOLO para esta demo (no toca ningún carrito real). Llamar con el nombre EXACTO devuelto por buscar_productos_demo — nunca inventarlo. La respuesta trae un campo "boton" que debes incluir TAL CUAL en tu mensaje, en su propia línea.',
      inputSchema: z.object({
        nombre: z.string().min(1).max(200).describe("Nombre exacto del producto, tal como lo devolvió buscar_productos_demo."),
        cantidad: z.number().int().positive().max(20).default(1),
      }),
      execute: async ({ nombre, cantidad }) => {
        const product = products.find((p) => p.name.toLowerCase() === nombre.toLowerCase());
        if (!product) {
          return { error: `No encontré "${nombre}" en el catálogo de ejemplo. Usa buscar_productos_demo de nuevo para confirmar el nombre.` };
        }
        return {
          ok: true,
          titulo: product.name,
          precio: clp(product.price),
          boton: `{{cart-add-demo:${cantidad}:${product.name}}}`,
        };
      },
    }),
  };
}

function buildExternalAgendaTools(t: EmbedTenant): ToolSet {
  if (t.externalAgenda?.provider === "dentalink") return buildDentalinkAgendaTools(t);
  if (t.externalAgenda?.provider === "agendapro") return buildAgendaProAgendaTools(t);
  return {};
}

export function buildEmbedTools(t: EmbedTenant): ToolSet {
  return {
    ...(t.externalAgenda ? buildExternalAgendaTools(t) : buildEmbedAgendaTools(t)),
    ...buildEmbedStoreTools(t),
    ...buildShopifyTools(t),
    ...buildDemoStoreTools(t),
    registrar_contacto: tool({
      description:
        "Registra los datos de contacto de una persona interesada y avisa al negocio. Llamar SOLO cuando la persona quiere reservar, comprar, cotizar o que la contacten, Y ya entregó su nombre y un teléfono real. Nunca inventes nombre ni teléfono: úsalos tal como los dio la persona.",
      inputSchema: z.object({
        nombre: z.string().min(2).max(120).describe("Nombre de la persona, tal como lo dio."),
        telefono: z
          .string()
          .min(6)
          .max(25)
          .describe("Teléfono real de la persona (ej. +56 9 1234 5678). Nunca inventarlo."),
        interes: z
          .string()
          .min(2)
          .max(400)
          .describe("Qué necesita, consultó o quiere concretar, en pocas palabras."),
        email: z.string().email().optional().describe("Email de la persona, solo si lo entregó."),
      }),
      execute: async (data) => {
        try {
          const summary = contactoSummary(t, data);
          const ownerWa = t.whatsapp;
          await Promise.all([
            notifyByEmail(
              `📩 Nuevo contacto — ${t.businessName}`,
              contactoEmailBody(t, data, summary),
              t.ownerNotifyEmail,
              process.env.EMBED_NOTIFY_CC
            ),
            ownerWa && process.env.NOTIFY_WA_TOKEN
              ? notifyByWhatsApp(ownerWa, summary)
              : Promise.resolve(false),
          ]);
          return { ok: true, note: "Contacto registrado; el negocio te contactará pronto." };
        } catch {
          return {
            error: "No se pudo registrar el contacto ahora. Ofrece derivar al WhatsApp del negocio.",
          };
        }
      },
    }),
  };
}
