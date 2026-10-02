import { defineClientConfig } from "@/config/schema";

const clientConfig = defineClientConfig({
  meta: {
    slug: "vidal-asociados",
    businessName: "Vidal & Asociados",
    rubro: "Estudio jurídico y contable",
    locale: "es-CL",
  },

  branding: {
    logoUrl: "/clients/vidal-asociados/logo.svg",
    faviconUrl: "/clients/vidal-asociados/logo.svg",
    palette: {
      primary: "#0B3D2E",
      accent: "#B08D57",
      background: "#FAFAF8",
      foreground: "#141414",
    },
    fontPairing: "modern",
  },

  hero: {
    title: "Asesoría legal y contable con respaldo",
    subtitle: "Más de 15 años ayudando a pymes y personas naturales en Santiago a resolver sus trámites legales y tributarios.",
    ctaLabel: "Agenda una consulta",
    ctaHref: "#contacto",
    backgroundImageUrl: "/clients/vidal-asociados/hero.jpg",
  },

  services: [
    { icon: "Scale", title: "Derecho laboral", description: "Asesoría a trabajadores y empleadores en despidos, finiquitos y contratos." },
    { icon: "Calculator", title: "Contabilidad para pymes", description: "Declaraciones de renta, IVA y remuneraciones mensuales." },
    { icon: "Briefcase", title: "Constitución de empresas", description: "Formaliza tu negocio en menos de una semana." },
    { icon: "FileText", title: "Redacción de contratos", description: "Contratos comerciales, arriendos y acuerdos societarios." },
    { icon: "Users", title: "Asesoría a familias", description: "Sucesiones, herencias y derecho de familia." },
  ],

  about: {
    title: "Un equipo, todas las áreas",
    body: "Vidal & Asociados nace en 2009 con la idea de ofrecer asesoría legal y contable bajo un mismo techo, pensando especialmente en pequeñas y medianas empresas que no cuentan con un departamento legal propio.",
    imageUrl: "/clients/vidal-asociados/nosotros.jpg",
  },

  contact: {
    phone: "+56 2 2345 6789",
    whatsapp: "56923456789",
    whatsappPrefilledMessage: "Hola! Quiero agendar una consulta con Vidal & Asociados",
    email: "contacto@vidalasociados.cl",
    address: "Av. Apoquindo 4500, oficina 802, Las Condes, Santiago",
    mapQuery: "Av. Apoquindo 4500, Las Condes, Santiago, Chile",
    hours: [
      { day: "Lunes a viernes", open: "09:00", close: "18:30" },
      { day: "Sábado y domingo", closed: true },
    ],
    socials: [
      { platform: "linkedin", url: "https://linkedin.com/company/vidal-asociados" },
    ],
  },

  modules: {
    contactForm: true,
    whatsappButton: true,
    testimonials: true,
    faq: true,
    pricing: true,
    chat: true,
  },

  testimonials: [
    { name: "Constructora Los Aromos", quote: "Nos ayudaron a formalizar la empresa en tiempo récord.", rating: 5 },
    { name: "Paula S.", quote: "Excelente asesoría en mi finiquito, muy claros y directos.", rating: 5 },
  ],

  faq: [
    { q: "¿Atienden a personas naturales o solo empresas?", a: "Atendemos ambos casos: personas naturales y empresas de todos los tamaños." },
    { q: "¿La primera consulta tiene costo?", a: "La primera reunión de diagnóstico de 30 minutos es sin costo." },
    { q: "¿Trabajan de forma remota?", a: "Sí, la mayoría de nuestras asesorías se pueden hacer por videollamada." },
    { q: "¿Cuánto demora constituir una empresa?", a: "En general entre 5 y 7 días hábiles, dependiendo del tipo de sociedad." },
  ],

  pricing: [
    {
      name: "Consulta puntual",
      price: "$45.000",
      features: ["Reunión de 1 hora", "Informe escrito con recomendaciones"],
    },
    {
      name: "Contabilidad mensual",
      price: "$120.000/mes",
      features: ["Declaración de IVA", "Remuneraciones", "Declaración de renta anual"],
      highlighted: true,
    },
    {
      name: "Asesoría empresarial",
      price: "A medida",
      features: ["Abogado y contador dedicados", "Reuniones mensuales", "Prioridad en consultas"],
    },
  ],

  chat: {
    businessDescription: "Vidal & Asociados es un estudio jurídico y contable en Las Condes, Santiago, especializado en pymes y personas naturales, con más de 15 años de trayectoria.",
    qaPairs: [
      { q: "¿Qué servicios ofrecen?", a: "Derecho laboral, contabilidad para pymes, constitución de empresas, contratos y asesoría familiar." },
      { q: "¿Cuál es el horario de atención?", a: "Lunes a viernes de 9:00 a 18:30. Cerrado fines de semana." },
      { q: "¿La primera consulta tiene costo?", a: "No, la primera reunión de diagnóstico de 30 minutos es gratuita." },
      { q: "¿Dónde están ubicados?", a: "En Av. Apoquindo 4500, oficina 802, Las Condes." },
      { q: "¿Atienden de forma remota?", a: "Sí, la mayoría de las asesorías se pueden hacer por videollamada." },
    ],
    fallbackToWhatsapp: true,
  },

  seo: {
    title: "Vidal & Asociados — Estudio jurídico y contable en Las Condes",
    description: "Asesoría legal y contable para pymes y personas naturales en Santiago. Derecho laboral, contabilidad y constitución de empresas.",
    businessType: "LegalService",
    priceRange: "$$$",
    keywords: ["abogado las condes", "contador pyme santiago", "constitución de empresas chile"],
  },
});

export default clientConfig;
