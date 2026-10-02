import { defineClientConfig } from "@/config/schema";

// Plantilla en blanco. El CLI `npm run new-client` parte de este archivo cuando
// no se especifica --preset. Reemplaza cada TODO con los datos reales del cliente.

const clientConfig = defineClientConfig({
  meta: {
    slug: "nombre-del-cliente",
    businessName: "TODO: Nombre del negocio",
    rubro: "TODO: rubro del negocio",
    locale: "es-CL",
  },

  branding: {
    logoUrl: "/clients/nombre-del-cliente/logo.png",
    palette: {
      primary: "#2563EB",
      accent: "#F59E0B",
      background: "#FFFFFF",
      foreground: "#111111",
    },
    fontPairing: "modern",
  },

  hero: {
    title: "TODO: título principal",
    subtitle: "TODO: subtítulo de apoyo",
    ctaLabel: "TODO: texto del botón",
    ctaHref: "#contacto",
  },

  services: [
    { icon: "Star", title: "TODO: servicio 1", description: "TODO: descripción" },
    { icon: "Star", title: "TODO: servicio 2", description: "TODO: descripción" },
    { icon: "Star", title: "TODO: servicio 3", description: "TODO: descripción" },
  ],

  about: {
    title: "TODO: título nosotros",
    body: "TODO: historia del negocio",
  },

  contact: {
    phone: "+56 9 0000 0000",
    whatsapp: "56900000000",
    address: "TODO: dirección",
    mapQuery: "TODO: dirección para el mapa",
    hours: [{ day: "Lunes a viernes", open: "09:00", close: "18:00" }],
  },

  modules: {
    contactForm: true,
    whatsappButton: true,
    testimonials: false,
    faq: false,
    pricing: false,
    chat: true,
    // tienda: true, // + bloque `store` con productos (ver restaurante.config.ts)
  },

  chat: {
    businessDescription: "TODO: descripción breve del negocio para el chat IA",
    qaPairs: [{ q: "TODO: pregunta frecuente", a: "TODO: respuesta oficial" }],
    fallbackToWhatsapp: true,
  },

  seo: {
    title: "TODO: título SEO",
    description: "TODO: descripción SEO",
    businessType: "LocalBusiness",
  },
});

export default clientConfig;
