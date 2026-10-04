import { clientConfig } from "@/config/client.config";
import { retentionMonths, arcoEmail } from "@/lib/privacy";

export interface PrivacySection {
  title: string;
  body: string[];
}

// Arma la política de privacidad EN FUNCIÓN de qué módulos tiene realmente
// activados este sitio (agenda, tienda, propiedades, chat, panel inmobiliario)
// — para no declarar que se trata un dato que este cliente en particular no
// recolecta, ni omitir uno que sí. Contenido operativo (qué se recolecta, para
// qué, cuánto se guarda, cómo pedir tus datos) — no reemplaza la revisión de
// un abogado antes de publicarla en un sitio real.
export function buildPrivacySections(): PrivacySection[] {
  const c = clientConfig;
  const sections: PrivacySection[] = [];

  sections.push({
    title: "1. Quién trata tus datos",
    body: [
      `${c.meta.businessName} (en adelante, "el negocio") es responsable de los datos personales que recolecta a través de este sitio, en los términos de la Ley N° 21.719 sobre Protección de Datos Personales.`,
      `El sitio y sus sistemas de agenda, tienda o gestión son operados técnicamente por HarayaDev como encargado de tratamiento, bajo instrucción del negocio — HarayaDev no usa estos datos para fines propios.`,
      c.contact.email ? `Contacto: ${c.contact.email}${c.contact.phone ? ` · ${c.contact.phone}` : ""}` : c.contact.phone ?? "",
    ].filter(Boolean),
  });

  const finalidades: string[] = [];
  if (c.modules.contactForm) finalidades.push("Responder tus consultas por el formulario de contacto (nombre, teléfono o correo, y el mensaje que escribas).");
  if (c.modules.chat) finalidades.push("Conversar contigo a través del asistente del sitio (y por WhatsApp, si nos escribes ahí) para responder tus preguntas y, si corresponde, derivarte a agendar o cotizar.");
  if (c.modules.agenda) finalidades.push("Gestionar tu reserva de hora (nombre, teléfono, servicio, fecha y hora) y avisarte sobre ella.");
  if (c.modules.tienda) finalidades.push("Procesar tu pedido y pago (nombre, dirección de contacto, y el pago mismo, que gestiona directamente el proveedor de pago — nunca vemos el número completo de tu tarjeta).");
  if (c.modules.propiedades || c.modules.inmobiliariaAdmin) finalidades.push("Gestionar tu interés en una propiedad (arriendo, venta o arriendo de temporada), incluyendo evaluación como arrendatario/a o comprador/a, y — si llegas a arrendar o comprar — los datos del contrato e informe de entrega/recepción correspondiente.");
  if (finalidades.length === 0) finalidades.push("Responder tus consultas de contacto.");
  sections.push({ title: "2. Para qué usamos tus datos", body: finalidades });

  sections.push({
    title: "3. Por qué podemos tratarlos",
    body: [
      "Porque nos diste tu consentimiento al enviar el formulario correspondiente (marcando la casilla de consentimiento).",
      "Porque es necesario para ejecutar el servicio que nos pediste (una reserva, una compra, un arriendo) — no podríamos prestarlo sin esos datos.",
    ],
  });

  const destinatarios = ["No vendemos tus datos ni los compartimos con terceros para fines de marketing, salvo lo que se indica a continuación sobre el Pixel de Meta (si aplica)."];
  if (process.env.NEXT_PUBLIC_META_PIXEL_ID) {
    destinatarios.push("Solo si lo aceptas en el aviso del sitio, usamos el Pixel de Meta: comparte con Meta (Facebook/Instagram) las páginas que visitas y los clics a la compra de entradas o a WhatsApp, para medir nuestros anuncios y mostrarte nuestros eventos. Si lo rechazas, el Pixel no se carga. Puedes cambiar tu decisión borrando los datos del sitio en tu navegador.");
  }
  destinatarios.push("Usamos proveedores de infraestructura para operar el sitio (hosting y base de datos en Vercel/Neon, envío de correos en Resend) — actúan como encargados de tratamiento, con las mismas obligaciones de seguridad.");
  if (c.modules.tienda) destinatarios.push("El pago lo procesa directamente Transbank (Webpay) — no almacenamos el número completo de tu tarjeta.");
  if (c.modules.agenda && c.booking?.depositAmount) destinatarios.push("El abono de tu reserva, si aplica, también lo procesa Transbank (Webpay).");
  destinatarios.push("Algunos de estos proveedores procesan datos en servidores fuera de Chile (EE.UU., típicamente) — cuentan con estándares de seguridad reconocidos internacionalmente (cifrado en tránsito y en reposo).");
  sections.push({ title: "4. Con quién se comparten", body: destinatarios });

  const retencion: string[] = [];
  if (c.modules.agenda) retencion.push(`Reservas: ${retentionMonths("bookings")} meses desde la fecha de la reserva.`);
  if (c.modules.tienda) retencion.push(`Pedidos: ${retentionMonths("orders")} meses (alineado a la guarda de documentación comercial que exige otra normativa).`);
  if (c.modules.chat) retencion.push(`Conversaciones con el asistente: ${retentionMonths("chatLogs")} meses.`);
  retencion.push(`Contactos por WhatsApp: ${retentionMonths("waThreads")} meses desde el último mensaje.`);
  if (c.modules.propiedades || c.modules.inmobiliariaAdmin) {
    retencion.push("Datos de clientes y propiedades: mientras dure la relación comercial (una venta o arriendo pueden implicar renovaciones o nuevos negocios en el tiempo) — se revisan periódicamente y se eliminan cuando ya no hay una relación activa.");
    retencion.push(`Informes de entrega/recepción: ${retentionMonths("realEstateDeliveries")} meses.`);
    retencion.push(`Contratos generados: ${retentionMonths("realEstateContracts")} meses.`);
  }
  retencion.push("Pasado ese plazo, tus datos se eliminan o anonimizan automáticamente — no los guardamos indefinidamente.");
  sections.push({ title: "5. Cuánto tiempo guardamos tus datos", body: retencion });

  sections.push({
    title: "6. Tus derechos (ARCO+)",
    body: [
      "Puedes pedirnos en cualquier momento: acceder a tus datos, corregirlos, eliminarlos, oponerte a su tratamiento, pedir una copia portable, o bloquearlos temporalmente.",
      `Escríbenos a ${arcoEmail() ?? "el contacto de este sitio"} o completa el formulario de solicitud en esta misma página — respondemos dentro de 30 días.`,
    ],
  });

  sections.push({
    title: "7. Seguridad",
    body: [
      "Tus datos viajan cifrados (HTTPS) y se guardan en una base de datos con acceso restringido. Las contraseñas o claves de acceso a los paneles nunca se comparten en texto plano ni se guardan en el código del sitio.",
      "Si ocurriera una brecha de seguridad que afecte tus datos, lo notificaremos a la autoridad y, si corresponde, a ti directamente, dentro de los plazos que exige la ley.",
    ],
  });

  return sections;
}
