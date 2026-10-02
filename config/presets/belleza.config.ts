import { defineClientConfig } from "@/config/schema";

// Preset para salones de belleza, spas y estudios de uñas/pestañas — separado
// de "barberia" (que trae copy y tono masculino de barbería tradicional) para
// que un salón de belleza no herede "Corte clásico"/"Afeitado tradicional".
// Paleta, tipografía y layout verificados con ui-ux-pro-max: "premium dark +
// gold accent" (--domain color "luxury beauty spa dark elegant") + Playfair
// Display/Inter + layout "belleza" ("exaggerated minimalism": tipografía
// oversized, alto contraste, un solo acento) — ver README → "Diseño
// distintivo por cliente".
const clientConfig = defineClientConfig({
  meta: {
    slug: "espacio-bella",
    businessName: "Espacio Bella",
    rubro: "Salón de belleza y spa",
    locale: "es-CL",
  },

  vocabulary: {
    professionalSingular: "Estilista",
    professionalPlural: "Estilistas",
    professionalExamples: "estilistas, esteticistas, manicuristas",
    clientSingular: "clienta",
    clientPlural: "Clientas",
  },

  branding: {
    logoUrl: "/clients/espacio-bella/logo.svg",
    faviconUrl: "/clients/espacio-bella/logo.svg",
    palette: {
      primary: "#1C1917",
      accent: "#A16207",
      background: "#FAFAF9",
      foreground: "#0C0A09",
    },
    fontPairing: "lujo",
    layout: "belleza",
  },

  hero: {
    title: "Belleza que se nota, cuidado que se siente",
    subtitle: "Corte, color, spa facial y uñas en un solo espacio en Providencia. Reserva tu hora en minutos.",
    ctaLabel: "Reservar hora",
    ctaHref: "#contacto",
    backgroundImageUrl: "/clients/espacio-bella/hero.jpg",
  },

  services: [
    { icon: "Scissors", title: "Corte y peinado", description: "Corte a la medida de tu rostro, con peinado incluido.", price: "$12.000" },
    { icon: "Palette", title: "Coloración", description: "Color, mechas y balayage con productos profesionales.", price: "$35.000" },
    { icon: "Sparkles", title: "Tratamiento facial", description: "Limpieza profunda e hidratación para todo tipo de piel.", price: "$18.000" },
    { icon: "Hand", title: "Manicure y pedicure", description: "Esmaltado tradicional o semipermanente.", price: "$15.000" },
    { icon: "Star", title: "Día de spa completo", description: "Nuestro paquete más pedido: facial + manicure + peinado.", price: "$45.000" },
  ],

  about: {
    title: "Un espacio pensado para ti",
    body: "Espacio Bella nació para que cuidar tu imagen sea un momento de calma, no un trámite. Un equipo de estilistas y esteticistas certificadas, en un ambiente cómodo y luminoso en el corazón de Providencia.",
    imageUrl: "/clients/espacio-bella/nosotros.jpg",
  },

  gallery: [
    { url: "/clients/espacio-bella/galeria-1.jpg", alt: "Sala de corte y color" },
    { url: "/clients/espacio-bella/galeria-2.jpg", alt: "Espacio de manicure" },
    { url: "/clients/espacio-bella/galeria-3.jpg", alt: "Sala de tratamientos faciales" },
  ],

  contact: {
    phone: "+56 9 8765 4321",
    whatsapp: "56987654321",
    whatsappPrefilledMessage: "Hola! Quiero reservar hora en Espacio Bella",
    email: "reservas@espaciobella.cl",
    address: "Av. Providencia 1234, Providencia, Santiago",
    mapQuery: "Av. Providencia 1234, Providencia, Santiago, Chile",
    hours: [
      { day: "Martes a viernes", open: "10:00", close: "19:00" },
      { day: "Sábado", open: "09:00", close: "17:00" },
      { day: "Domingo y lunes", closed: true },
    ],
    socials: [{ platform: "instagram", url: "https://instagram.com/espaciobella" }],
  },

  modules: {
    contactForm: true,
    whatsappButton: true,
    testimonials: true,
    faq: true,
    pricing: true,
    chat: true,
    agenda: true,
  },

  booking: {
    slotMinutes: 60,
    daysAhead: 21,
    depositNote:
      "Para confirmar tu hora pedimos un abono de $5.000, que se descuenta del servicio. Puedes pagarlo al tiro con tarjeta.",
    depositAmount: 5000,
  },

  testimonials: [
    { name: "Valentina R.", quote: "Salí con el cabello como nuevo, muy recomendable.", rating: 5 },
    { name: "Fernanda M.", quote: "El día de spa completo es una experiencia — vale cada peso.", rating: 5 },
  ],

  faq: [
    { q: "¿Necesito reservar hora?", a: "Sí, para asegurar tu horario con la estilista de tu preferencia." },
    { q: "¿Atienden a domicilio?", a: "Por ahora solo atendemos en nuestro local de Providencia." },
    { q: "¿Aceptan tarjeta?", a: "Sí, débito y crédito." },
  ],

  pricing: [
    {
      name: "Corte y peinado",
      price: "$12.000",
      features: ["Diagnóstico capilar", "Corte a la medida", "Peinado incluido"],
    },
    {
      name: "Día de spa completo",
      price: "$45.000",
      features: ["Tratamiento facial", "Manicure", "Peinado"],
      highlighted: true,
    },
    {
      name: "Coloración",
      price: "$35.000",
      features: ["Color o mechas", "Tratamiento post-color", "Peinado final"],
    },
  ],

  chat: {
    businessDescription: "Espacio Bella es un salón de belleza y spa en Providencia, Santiago, con servicios de corte, color, tratamientos faciales y uñas.",
    qaPairs: [
      { q: "¿Cuál es el horario?", a: "Martes a viernes de 10:00 a 19:00, sábado de 9:00 a 17:00. Cerrado domingo y lunes." },
      { q: "¿Cuánto cuesta un corte?", a: "El corte y peinado cuesta $12.000." },
      { q: "¿Cómo reservo hora?", a: "Puedes reservar directamente aquí en la página o por WhatsApp." },
      { q: "¿Dónde están ubicados?", a: "En Av. Providencia 1234, Providencia, Santiago." },
    ],
    fallbackToWhatsapp: true,
  },

  seo: {
    title: "Espacio Bella — Salón de belleza y spa en Providencia",
    description: "Corte, color, tratamientos faciales y uñas en Providencia, Santiago. Reserva tu hora online.",
    businessType: "BeautySalon",
    priceRange: "$$",
    keywords: ["salón de belleza providencia", "spa facial santiago", "manicure providencia", "peluquería mujer santiago"],
  },
});

export default clientConfig;
