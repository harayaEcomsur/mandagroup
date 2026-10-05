// Config activa del sitio — branch client/mandagroup (cliente real, reemplazo
// de ManyChat). Contenido real verificado en Instagram (@manda.chile,
// @mandavina.cl) y contacto confirmado por el cliente — nada inventado.
// La home no usa components/HomeContent.tsx (ver components/MandagroupHome.tsx
// + app/page.tsx); branding/contact/modules siguen siendo la fuente de verdad
// para Header/Footer/SEO/asistente igual que en cualquier otro cliente.
import { defineClientConfig } from "@/config/schema";

export const clientConfig = defineClientConfig({
  meta: {
    slug: "mandagroup",
    businessName: "Manda Group",
    rubro: "Discotecas y eventos",
    locale: "es-CL",
  },

  branding: {
    logoUrl: "/clients/mandagroup/logo-renaca.webp",
    faviconUrl: "/clients/mandagroup/logo-renaca.png",
    palette: {
      // Un solo acento: el dorado del logo de Manda Reñaca (cuenta insignia).
      // El rosa neón de Manda Viña queda en su propio logo, no en la UI — el
      // sitio es del holding (clubes + restaurantes) y se lee corporativo con
      // un único color de marca. "accent" es una variante más clara del mismo
      // dorado para detalles, no un segundo color.
      primary: "#E0A83E",
      accent: "#EBC57E",
      background: "#0B0B0D",
      foreground: "#F2EFE9",
    },
    // "nocturno" (Bricolage Grotesque + Hanken Grotesk): rediseño corporativo
    // nocturno del holding — sans de display moderna en vez de la serif
    // Playfair, que se leía más "restaurante elegante" que grupo de clubes.
    fontPairing: "nocturno",
    logoIncludesName: true,
    layout: "clasico",
    credit: true,
    navLinks: [
      { href: "/#eventos", label: "Cartelera" },
      { href: "/#marcas", label: "Marcas" },
      { href: "/#instagram", label: "Instagram" },
      { href: "/#contacto", label: "Contacto" },
    ],
  },

  // Home bespoke (MandagroupHome.tsx): estos campos igual alimentan el
  // asistente/SEO, aunque el hero visual de la home no los renderice literal.
  hero: {
    title: "Gastronomía, música y fiesta bajo un mismo grupo",
    subtitle: "Manda Reñaca y Manda Viña del Mar — reserva tu mesa o compra tu entrada directo por WhatsApp.",
    ctaLabel: "Reservar por WhatsApp",
    ctaHref: "#contacto",
  },

  services: [],

  about: {
    title: "Manda Group",
    body: "Manda Reñaca (Classic Social Lounge) y Manda Viña del Mar (fiesta, restaurant, música y amigos) — los locales del grupo, con la marca de fiestas Costa Nights. El holding también reúne otras marcas gastronómicas, como Costa Sushi y Carbon.",
  },

  contact: {
    whatsapp: "56931727237",
    whatsappPrefilledMessage: "Hola! Te escribo por Manda Group 😊",
    socials: [
      { platform: "instagram", url: "https://www.instagram.com/manda.chile/", label: "Manda Reñaca" },
      { platform: "instagram", url: "https://www.instagram.com/mandavina.cl/", label: "Manda Viña del Mar" },
    ],
  },

  modules: {
    contactForm: false,
    whatsappButton: true,
    testimonials: false,
    faq: false,
    pricing: false,
    chat: true,
    eventos: true,
  },

  chat: {
    businessDescription:
      "Manda Group opera 2 locales nocturnos: Manda Reñaca (Classic Social Lounge, Av. Borgoño 14.880, Reñaca) y Manda Viña del Mar (5 Norte 132, Viña del Mar). Costa Nights es la marca de fiestas del grupo. Te llamas Manda: eres la asistente virtual del grupo.",
    qaPairs: [
      { q: "¿Cómo reservo una mesa?", a: "Dime en qué local (Reñaca o Viña del Mar) y te paso el WhatsApp vigente para coordinar tu reserva." },
      { q: "¿Cómo compro entradas?", a: "Te muestro los eventos activos de Costa Nights y, al elegir uno, te paso el link real de compra." },
      { q: "¿Dónde están ubicados?", a: "Manda Reñaca: Av. Borgoño 14.880, Reñaca. Manda Viña del Mar: 5 Norte 132, Viña del Mar." },
      {
        q: "¿Cuál es el dress code?",
        a: "No se permite: pantalón con cargo/jogger, lentes de sol, short, bananos, ropa deportiva ni buzos, cadenas a la vista, poleras sin mangas, ni sandalias. El incumplimiento puede resultar en la solicitud de abandonar la fiesta.",
      },
    ],
    fallbackToWhatsapp: true,
  },

  // Dos locales, dos cuentas de Instagram reales — cada una con su propio
  // Page Access Token (env var distinta) para poder responder DMs desde la
  // cuenta correcta en vez de una sola para ambas.
  instagramAccounts: {
    "17841462428914603": "INSTAGRAM_TOKEN_MANDACHILE", // @manda.chile (Reñaca)
    "17841421479976537": "INSTAGRAM_TOKEN_MANDAVINA", // @mandavina.cl (Viña del Mar)
  },

  // Se envían siempre junto con la respuesta del asistente en Instagram
  // Direct, para no depender de que la IA "adivine" ofrecerlos.
  instagramActionButtons: [
    { title: "Entradas Reñaca", url: "https://vesti.cl/company/manda-renaca", kind: "tickets-renaca" },
    { title: "Entradas Viña", url: "https://vesti.cl/company/manda-group-vina", kind: "tickets-vina" },
    { title: "Reservar mesa", url: "https://wa.me/56990721033", kind: "reserva" },
  ],

  // Mismos 3 links, mostrados como botones en el chat del sitio (ver ChatWidget).
  chatActionButtons: [
    { label: "Entradas Manda Reñaca", url: "https://vesti.cl/company/manda-renaca" },
    { label: "Entradas Manda Viña del Mar", url: "https://vesti.cl/company/manda-group-vina" },
    { label: "Reservar mesa (WhatsApp)", url: "https://wa.me/56990721033" },
  ],

  seo: {
    // ~60 caracteres: marca + qué es + dónde. "Región de Valparaíso" cubre
    // los clubes (Reñaca, Viña) y Costa Sushi (Valparaíso, Curauma).
    title: "Manda Group | Clubes y restaurantes en la Región de Valparaíso",
    description:
      "Manda Reñaca y Manda Viña del Mar, fiestas Costa Nights, Costa Sushi en Valparaíso y Curauma, y Carbon. Entradas en Vesti y reservas por WhatsApp.",
    ogImageUrl: "/clients/mandagroup/og-manda.jpg",
    businessType: "NightClub",
    keywords: [
      "manda reñaca",
      "manda viña del mar",
      "manda group",
      "costa nights",
      "discoteca reñaca",
      "fiestas viña del mar",
      "costa sushi",
      "costa sushi valparaíso",
      "costa sushi curauma",
      "carbon parrilla",
    ],
    jsonLdInPage: true,
  },
});
