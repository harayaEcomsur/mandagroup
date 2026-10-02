import { defineClientConfig } from "@/config/schema";

// Preset corredora de propiedades (layout inmobiliaria + módulo propiedades).
// Pensado para la fábrica de demos: cartera DEMO plausible del borde costero
// V Región con fotos de stock (Unsplash) — reemplazar por el inventario real
// del cliente al contratar. El nombre ficticio lo sustituye applyIdentity.
const clientConfig = defineClientConfig({
  meta: {
    slug: "corredora-costa-azul",
    businessName: "Corredora Costa Azul",
    rubro: "Compra-venta, arriendo y administración de propiedades",
    locale: "es-CL",
  },

  branding: {
    logoUrl: "/clients/corredora-costa-azul/logo.svg",
    faviconUrl: "/clients/corredora-costa-azul/logo.svg",
    palette: {
      primary: "#1D4ED8",
      accent: "#0F766E",
      background: "#F8FAFC",
      foreground: "#0F172A",
    },
    fontPairing: "elegante",
    logoIncludesName: true,
    layout: "inmobiliaria",
  },

  hero: {
    title: "Propiedades en la costa, con corretaje de verdad",
    subtitle:
      "Compra-venta, arriendo residencial y de temporada, y administración de propiedades en Viña del Mar, Reñaca y Concón. Trato directo y conocimiento real del barrio.",
    ctaLabel: "Conversemos por WhatsApp",
    ctaHref: "#contacto",
    backgroundImageUrl: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1600&q=80",
  },

  services: [
    { icon: "Home", title: "Venta de propiedades", description: "Tasación, publicación, visitas y negociación hasta la firma." },
    { icon: "KeyRound", title: "Arriendo residencial", description: "Búsqueda y evaluación de arrendatarios con informe comercial y contrato al día." },
    { icon: "CalendarDays", title: "Arriendo de temporada", description: "Publicación, reservas, entrega y recepción de departamentos de temporada." },
    { icon: "Building2", title: "Administración de propiedades", description: "Cobros, mantenciones, coordinación con arrendatarios y rendición mensual." },
    { icon: "TrendingUp", title: "Tasación y estudio de mercado", description: "Valorización realista según el mercado actual y ventas comparables de la comuna." },
    { icon: "Users", title: "Asesoría a compradores", description: "Acompañamiento en visitas, revisión de documentación y negociación del precio." },
  ],

  about: {
    title: "Conocemos el barrio",
    body: "Corredora Costa Azul gestiona compra-venta, arriendos y administración de propiedades en el borde costero de la V Región, con un sello simple: trato cercano, conocimiento real de cada sector y todo por escrito.",
    imageUrl: "https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=1200&q=80",
  },

  gallery: [
    { url: "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=1200&q=80", alt: "Casa moderna con piscina" },
    { url: "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=1200&q=80", alt: "Living comedor luminoso" },
    { url: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200&q=80", alt: "Vista a la playa" },
  ],

  contact: {
    phone: "+56 9 0000 0000",
    whatsapp: "56900000000",
    whatsappPrefilledMessage: "Hola! Vi el sitio de Corredora Costa Azul y quiero consultar por una propiedad",
    hours: [
      { day: "Lunes a viernes", open: "09:30", close: "18:30" },
      { day: "Sábado", open: "10:00", close: "13:30" },
      { day: "Domingo", closed: true },
    ],
  },

  modules: {
    contactForm: true,
    whatsappButton: true,
    testimonials: false,
    faq: true,
    pricing: false,
    chat: true,
    propiedades: true,
  },

  // Sindicación visible en la demo (la integración real se activa al contratar).
  syndication: {
    portalinmobiliario: true,
    instagram: true,
  },

  // Cartera DEMO — propiedades ficticias pero plausibles para mostrar el
  // buscador y las fichas. Reemplazar por el inventario real del cliente.
  properties: [
    {
      slug: "depto-vista-mar-renaca",
      title: "Departamento vista al mar",
      operation: "arriendo_temporada",
      type: "departamento",
      comuna: "Reñaca",
      price: "desde $90.000/noche",
      bedrooms: 2,
      bathrooms: 1,
      area: 65,
      description: "A pasos de la playa, con vista despejada al mar desde el living y la terraza. Equipado completo para 4 personas: ideal temporada de verano y fines de semana largos.",
      images: [
        "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200&q=80",
        "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=1200&q=80",
      ],
      featured: true,
    },
    {
      slug: "depto-centro-vina",
      title: "Departamento remodelado en el centro",
      operation: "venta",
      type: "departamento",
      comuna: "Viña del Mar",
      price: "UF 4.200",
      bedrooms: 3,
      bathrooms: 2,
      area: 85,
      parking: 1,
      description: "Departamento completamente remodelado a cuadras de la plaza: piso flotante, cocina renovada y excelente conectividad. Edificio con conserjería 24 horas.",
      images: [
        "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=1200&q=80",
        "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=1200&q=80",
      ],
      featured: true,
    },
    {
      slug: "casa-mediterranea-concon",
      title: "Casa mediterránea con jardín",
      operation: "venta",
      type: "casa",
      comuna: "Concón",
      price: "UF 8.900",
      bedrooms: 4,
      bathrooms: 3,
      area: 180,
      parking: 2,
      description: "Casa mediterránea en barrio consolidado: living comedor con salida a terraza, cocina amoblada, dormitorio en suite y jardín con quincho.",
      images: [
        "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200&q=80",
        "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1200&q=80",
      ],
      featured: true,
    },
    {
      slug: "depto-condominio-piscina",
      title: "Departamento con terraza y piscina",
      operation: "arriendo",
      type: "departamento",
      comuna: "Reñaca",
      price: "$650.000/mes",
      bedrooms: 2,
      bathrooms: 2,
      area: 70,
      parking: 1,
      description: "Arriendo anual en condominio con piscina y quincho comunitario. Cocina equipada, logia y bodega. Requiere informe comercial — gestionamos todo el proceso.",
      images: [
        "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=1200&q=80",
        "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=1200&q=80",
      ],
    },
    {
      slug: "depto-familiar-oriente",
      title: "Departamento familiar orientación norte",
      operation: "venta",
      type: "departamento",
      comuna: "Viña del Mar",
      price: "UF 5.800",
      bedrooms: 3,
      bathrooms: 2,
      area: 95,
      parking: 1,
      description: "Amplio departamento familiar: living luminoso, tres dormitorios y logia independiente. Cerca de supermercados, colegios y locomoción.",
      images: [
        "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=1200&q=80",
        "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=1200&q=80",
      ],
    },
    {
      slug: "casa-arriendo-anual",
      title: "Casa con jardín para arriendo anual",
      operation: "arriendo",
      type: "casa",
      comuna: "Concón",
      price: "$1.200.000/mes",
      bedrooms: 3,
      bathrooms: 2,
      area: 140,
      parking: 2,
      description: "Casa aislada con jardín y estacionamiento para dos autos en sector residencial tranquilo. Disponible para arriendo anual con contrato.",
      images: [
        "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1200&q=80",
        "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200&q=80",
      ],
    },
  ],

  faq: [
    { q: "¿En qué zonas trabajan?", a: "Principalmente en el borde costero de la V Región: Viña del Mar, Reñaca y Concón." },
    { q: "¿Hacen arriendos por temporada?", a: "Sí: publicación, reservas, entrega y recepción de departamentos de temporada." },
    { q: "¿Qué incluye la administración de propiedades?", a: "Cobro de arriendos, coordinación de mantenciones, relación con los arrendatarios y rendición mensual." },
    { q: "¿Cómo publico mi propiedad con ustedes?", a: "Escríbenos por WhatsApp o el formulario. Coordinamos visita, tasación y publicación — solo cobramos si el negocio se concreta." },
    { q: "¿Atienden fuera de horario de oficina?", a: "Las visitas se coordinan según tu disponibilidad, incluidos fines de semana con cita previa." },
  ],

  chat: {
    businessDescription:
      "Corredora Costa Azul es una corredora de propiedades del borde costero de la V Región (Viña del Mar, Reñaca, Concón). Servicios: compra-venta, arriendo residencial, arriendo de temporada, administración de propiedades, tasación y asesoría a compradores. Su sello es el trato cercano y el conocimiento del barrio.",
    qaPairs: [
      { q: "¿En qué zonas trabajan?", a: "Viña del Mar, Reñaca y Concón principalmente." },
      { q: "¿Hacen arriendos por temporada?", a: "Sí: administración completa de departamentos de temporada (publicación, reservas, entrega y recepción)." },
      { q: "¿Qué incluye la administración?", a: "Cobro de arriendos, mantenciones, relación con arrendatarios y rendición mensual al propietario." },
      { q: "¿Cómo publico mi propiedad?", a: "Por WhatsApp o el formulario de contacto: se coordina visita, tasación y publicación. Solo se cobra si el negocio se concreta." },
      { q: "¿Cuánto cobran de comisión?", a: "Las condiciones se conversan según el servicio (venta, arriendo o administración) — escríbeles por WhatsApp y te responden al tiro." },
    ],
    fallbackToWhatsapp: true,
  },

  seo: {
    title: "Corredora Costa Azul — Propiedades en Viña del Mar, Reñaca y Concón",
    description:
      "Compra-venta, arriendo residencial y de temporada, y administración de propiedades en el borde costero de la V Región.",
    businessType: "RealEstateAgent",
    priceRange: "$$",
    keywords: ["corredora de propiedades viña del mar", "arriendo reñaca", "propiedades concón"],
  },
});

export default clientConfig;
