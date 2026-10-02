import { defineClientConfig } from "@/config/schema";

const clientConfig = defineClientConfig({
  meta: {
    slug: "sabores-del-barrio",
    businessName: "Sabores del Barrio",
    rubro: "Food truck / comida rápida gourmet",
    locale: "es-CL",
  },

  branding: {
    logoUrl: "/clients/sabores-del-barrio/logo.svg",
    faviconUrl: "/clients/sabores-del-barrio/logo.svg",
    palette: {
      primary: "#D9480F",
      accent: "#F2A65A",
      background: "#FFFBF5",
      foreground: "#2B1B12",
    },
    fontPairing: "amigable",
  },

  hero: {
    title: "Comida callejera con sabor de barrio",
    subtitle: "Empanadas, choripanes y completos preparados al momento, en el corazón de Providencia.",
    ctaLabel: "Ver el menú",
    ctaHref: "#servicios",
    backgroundImageUrl: "/clients/sabores-del-barrio/hero.jpg",
  },

  services: [
    { icon: "UtensilsCrossed", title: "Menú del día", description: "Plato de fondo + bebida a precio fijo, de lunes a viernes.", price: "$5.990" },
    { icon: "Pizza", title: "Completos y choripanes", description: "Receta de la casa, con ají verde preparado.", price: "Desde $3.500" },
    { icon: "Truck", title: "Food truck para eventos", description: "Llevamos el carro a cumpleaños, matrimonios y eventos de empresa." },
    { icon: "ShoppingBag", title: "Para llevar", description: "Pide con anticipación y retira sin fila." },
    { icon: "Coffee", title: "Café y bebidas", description: "Café de grano, jugos naturales y bebidas heladas." },
    { icon: "Star", title: "Menú vegetariano", description: "Opciones sin carne, mismo sabor de siempre." },
  ],

  about: {
    title: "Nuestra historia",
    body: "Partimos el 2019 como un carrito en la feria de Ñuñoa. Hoy tenemos ubicación fija en Providencia, pero seguimos cocinando con las mismas recetas familiares de siempre.",
    imageUrl: "/clients/sabores-del-barrio/nosotros.jpg",
  },

  gallery: [
    { url: "/clients/sabores-del-barrio/galeria-1.jpg", alt: "Choripán con ají verde" },
    { url: "/clients/sabores-del-barrio/galeria-2.jpg", alt: "Empanadas recién horneadas" },
    { url: "/clients/sabores-del-barrio/galeria-3.jpg", alt: "Food truck en evento" },
  ],

  contact: {
    phone: "+56 9 5123 4567",
    whatsapp: "56951234567",
    whatsappPrefilledMessage: "Hola! Quiero hacer un pedido en Sabores del Barrio",
    email: "contacto@saboresdelbarrio.cl",
    address: "Av. Providencia 1234, Providencia, Santiago",
    mapQuery: "Av. Providencia 1234, Providencia, Santiago, Chile",
    hours: [
      { day: "Lunes a viernes", open: "12:00", close: "22:00" },
      { day: "Sábado", open: "13:00", close: "23:00" },
      { day: "Domingo", closed: true },
    ],
    socials: [
      { platform: "instagram", url: "https://instagram.com/saboresdelbarrio.cl" },
    ],
  },

  modules: {
    contactForm: true,
    whatsappButton: true,
    testimonials: true,
    faq: true,
    pricing: false,
    chat: true,
    tienda: true,
  },

  store: {
    products: [
      {
        slug: "pack-12-empanadas",
        name: "Pack 12 empanadas congeladas",
        price: 14990,
        description: "Pino, queso o mixtas — listas para hornear en casa.",
        category: "Para llevar",
      },
      {
        slug: "aji-verde-250",
        name: "Ají verde de la casa 250 g",
        price: 3990,
        description: "La receta que acompaña nuestros choripanes, en frasco.",
        category: "Salsas",
      },
      {
        slug: "salsa-bbq-300",
        name: "Salsa BBQ ahumada 300 ml",
        price: 4490,
        description: "Ahumada en casa, ideal para carnes y sándwiches.",
        category: "Salsas",
      },
      {
        slug: "gift-card-almuerzo",
        name: "Gift card almuerzo para dos",
        price: 15990,
        description: "Dos menús del día + bebidas. Se canjea presentando el número de pedido.",
        category: "Gift cards",
      },
    ],
    shippingNote:
      "Retiro en el local (Av. Providencia 1234) o despacho a Providencia y Ñuñoa — lo coordinamos por WhatsApp después del pago.",
  },

  testimonials: [
    { name: "Camila R.", quote: "El mejor choripán de Providencia, sin duda.", rating: 5 },
    { name: "Matías G.", quote: "Pedimos el food truck para el cumpleaños de la empresa y fue un éxito.", rating: 5 },
  ],

  faq: [
    { q: "¿Hacen despacho a domicilio?", a: "Sí, a través de Uber Eats y Rappi en Providencia y Ñuñoa." },
    { q: "¿Aceptan tarjeta?", a: "Sí, débito, crédito y transferencia." },
    { q: "¿Tienen opciones sin gluten?", a: "Por ahora no, pero lo estamos evaluando para el segundo semestre." },
  ],

  chat: {
    businessDescription: "Sabores del Barrio es un food truck de comida callejera chilena (empanadas, choripanes, completos) ubicado en Providencia, Santiago, con más de 5 años de trayectoria.",
    qaPairs: [
      { q: "¿Cuál es el horario?", a: "Lunes a viernes de 12:00 a 22:00, sábado de 13:00 a 23:00. Cerrado los domingos." },
      { q: "¿Dónde están ubicados?", a: "En Av. Providencia 1234, Providencia, Santiago." },
      { q: "¿Hacen eventos?", a: "Sí, llevamos el food truck a cumpleaños, matrimonios y eventos de empresa. Escríbenos por WhatsApp para cotizar." },
      { q: "¿Tienen menú vegetariano?", a: "Sí, tenemos opciones vegetarianas en la carta." },
      { q: "¿Cómo pago?", a: "Aceptamos efectivo, débito, crédito y transferencia." },
    ],
    fallbackToWhatsapp: true,
  },

  themeVariants: [
    {
      id: "a",
      name: "Cálida (actual)",
      palette: { primary: "#D9480F", accent: "#F2A65A", background: "#FFFBF5", foreground: "#2B1B12" },
    },
    {
      id: "b",
      name: "Verde parrilla",
      palette: { primary: "#2F5D3A", accent: "#E8A13C", background: "#FAFBF7", foreground: "#1C2419" },
    },
    {
      id: "c",
      name: "Nocturna",
      palette: { primary: "#E05A1A", accent: "#F2A65A", background: "#1F1209", foreground: "#F6EFE8" },
    },
  ],

  seo: {
    title: "Sabores del Barrio — Comida callejera chilena en Providencia",
    description: "Empanadas, choripanes y completos preparados al momento. Food truck disponible para eventos en Santiago.",
    businessType: "Restaurant",
    priceRange: "$$",
    keywords: ["comida callejera", "food truck santiago", "choripan providencia", "empanadas"],
  },
});

export default clientConfig;
