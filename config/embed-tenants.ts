// Registro multi-tenant del ASISTENTE EMBEBIBLE (add-on IA sobre el sitio que el
// cliente YA tiene). Es un camino aparte del sitio single-tenant por branch: el
// mismo despliegue de HarayaDev atiende a varios negocios ajenos, resueltos por
// `tenantId`. Aislado a propósito de `client.config` y de `/api/chat` para no
// tocar las demos vivas.
//
// Estado: conocimiento conversacional + derivación a WhatsApp + captura de
// contacto por tenant + agenda por tenant con verdad de servidor (disponibilidad
// y reservas, persistidas en Postgres si hay DATABASE_URL; ver lib/embed-agenda.ts).
// Pendiente del siguiente slice: tienda/pedido por tenant y aislamiento de
// secretos de pago por tenant (Webpay propio por cliente) — ver diferenciador-vs-darwin.md.

export interface EmbedTenant {
  id: string;
  businessName: string;
  rubro: string;
  // Qué hace el negocio, en una o dos frases.
  description: string;
  // Conocimiento en texto libre: horarios, precios, servicios, ubicación,
  // políticas. Es la "verdad" contra la que responde el asistente en el MVP.
  facts: string;
  // Para derivar cuando el asistente no sabe o piden hablar con una persona, y
  // como destino del aviso de contacto al dueño por WhatsApp (desde el número de
  // HarayaDev, si hay NOTIFY_WA_TOKEN).
  whatsapp?: string;
  // Email del dueño del negocio: destino del aviso cuando el asistente captura un
  // contacto/lead. Si se omite, cae a BOOKINGS_NOTIFY_EMAIL (o no envía email).
  ownerNotifyEmail?: string;
  // Orígenes permitidos para CORS (el/los dominios del sitio del cliente). Si se
  // omite, el endpoint refleja el Origin (útil en demos); en producción conviene
  // acotarlo al dominio real del cliente.
  allowedOrigins?: string[];
  // Modelo por tenant (opcional). Por defecto gemini-3.5-flash-lite (barato, ok
  // para conversar). OJO: para tenants con `agenda`/tools de escritura usa
  // gemini-2.5-flash — el -lite es demasiado débil decidiendo llamar la tool de
  // reserva (conversa y "confirma" sin ejecutarla). Verificado en vivo.
  model?: string;
  // Emojis en las respuestas (opcional, default false). Off por defecto porque
  // no calza con todos los rubros (una clínica dental/estética no quiere el
  // mismo tono que una barbería o un salón) — se activa por tenant según su
  // propia marca, nunca por defecto.
  useEmojis?: boolean;
  // Globo que invita a hacer clic en el botón del widget (opcional). Sin
  // esto, widget.js usa un texto genérico — este es solo para darle un tono
  // propio del rubro (más conversión que el genérico, nunca obligatorio).
  teaserMessage?: string;
  // Cómo se presenta el widget al cargar la página (opcional, default "bubble").
  // "bubble": comportamiento de siempre — botón + globo opcional, el visitante
  // decide cuándo abrir. "popup": el chat se abre solo al cargar, como un
  // modal centrado con fondo oscurecido (en vez del panel anclado a la
  // esquina) — pensado para una demo puntual de alto impacto con un prospecto
  // importante, no para dejarlo así en su sitio real en producción (un modal
  // que se abre solo en cada visita es más intrusivo que el globo discreto;
  // conviene volver a "bubble" antes de instalar el widget de verdad, salvo
  // que el cliente pida mantenerlo). widget.js ignora el globo teaser en modo
  // popup (el propio popup ya cumple ese rol de invitación).
  openStyle?: "bubble" | "popup";
  // Agenda conversacional por tenant (opcional). Si está, el asistente puede
  // consultar disponibilidad REAL y crear reservas (nunca inventa horarios). El
  // motor vive en lib/embed-agenda.ts, aislado del booking-store single-tenant.
  agenda?: {
    // Servicios reservables (nombres tal como los ve el cliente).
    services: string[];
    // Horario de atención, mismo formato que client.config.contact.hours:
    // etiquetas como "Lunes a viernes", "Martes a sábado", "Sábado".
    hours: { day: string; open?: string; close?: string; closed?: boolean }[];
    // Duración de cada hora reservable en minutos (default 60).
    slotMinutes?: number;
    // Cuántos días hacia adelante se puede reservar (default 14).
    daysAhead?: number;
  };
  // Agenda EXTERNA (opcional, mutuamente excluyente con `agenda`): para
  // tenants que YA reservan en un sistema externo con API real. En vez de
  // nuestro motor propio (lib/embed-agenda.ts), el asistente consulta y
  // reserva directo en la cuenta real del cliente. El token vive SOLO en una
  // env var namespaced por tenant (nunca acá) — sin ella, estas tools no se
  // activan y el tenant queda sin agenda conversacional (solo deriva).
  externalAgenda?:
    | {
        // Dentalink: NO es autoservicio — el cliente debe pagarle a Dentalink
        // por el add-on de API antes de poder generar su token (ver
        // lib/embed-dentalink.ts). Token en DENTALINK_TOKEN_<ID>.
        provider: "dentalink";
        idSucursal: number;
        idEspecialidad: number;
        // Si se omite, se reserva sin fijar profesional (Dentalink asigna uno
        // con agenda online habilitada para esa especialidad/sucursal).
        idDentista?: number;
        duracionMin: number;
      }
    | {
        // AgendaPro: SÍ es autoservicio — el cliente genera su propia API key
        // desde Configuraciones > Integraciones en su cuenta, con los scopes
        // bookings:read, bookings:write y clients:write (ver
        // lib/embed-agendapro.ts). Token en AGENDAPRO_TOKEN_<ID>.
        provider: "agendapro";
        idLocation: number;
        idService: number;
        // Si se omite, se reserva con el primer profesional que devuelva
        // disponibilidad para ese servicio/sucursal.
        idProvider?: number;
      };
  // Tienda por tenant (opcional). Si está, el asistente puede armar un pedido y
  // entregar link de pago Webpay. Los precios se resuelven en el servidor desde
  // este catálogo (nunca desde el modelo). El aislamiento de la plata (Transbank
  // propio por cliente) va por env vars namespaced — ver lib/embed-webpay.ts.
  store?: {
    products: {
      slug: string;
      name: string;
      price: number; // CLP entero
      description?: string;
      category?: string;
      available?: boolean; // default true
    }[];
    shippingNote?: string;
  };
  // Concierge sobre una tienda Shopify REAL del cliente (mutuamente excluyente
  // con `store`): el asistente busca en su catálogo en vivo y agrega productos
  // al carrito de esa visita — ver lib/embed-shopify.ts. No requiere ningún
  // token del cliente (endpoints públicos de Shopify), pero SOLO funciona
  // agregando al carrito de verdad una vez que el widget está instalado en el
  // dominio real de la tienda (el carrito es same-origin) — probado con
  // fetch directo a los endpoints y con /cart/add.js ejecutado en el propio
  // sitio, nunca desde un origen distinto.
  shopify?: {
    domain: string; // ej. "yukipet.cl" (el dominio donde vive/vivirá el widget)
  };
  // Concierge de tienda SIMULADO (mutuamente excluyente con `store` y
  // `shopify`): para prospectos cuyo comercio real SÍ corre en Shopify pero
  // sin ningún endpoint público reutilizable — verificado en vivo con
  // samsonite.com.mx/saxoline.cl: la app agrega al carrito con un Server
  // Action propio (POST a la misma URL de la página, con el GID de Shopify
  // en el body), no con /cart/add.js público, y no exponen ningún token de
  // Storefront API en el bundle del cliente — o para negocios que
  // directamente no corren en Shopify (Builder.io + Next.js headless en este
  // caso). El asistente "busca" en este catálogo curado a mano (nombres y
  // precios REALES sacados del sitio, nunca inventados — igual que `facts`)
  // y el botón de agregar al carrito muestra una confirmación SIMULADA (el
  // widget nunca llama un endpoint real) — ver `buildDemoStoreTools` en
  // lib/embed-tools.ts. Deja siempre explícito que es una prueba de
  // concepto, nunca una compra real: nunca lo ofrezcas como "ya conectado",
  // sino como un adelanto de cómo se vería una vez integrado de verdad.
  demoStore?: {
    products: {
      name: string;
      price: number;
      description?: string;
      // URL real de foto del producto (hotlink al CDN del propio sitio —
      // igual que demoBranding, nunca inventar ni usar un placeholder). El
      // widget la renderiza como imagen real en el chat (sintaxis markdown
      // ![alt](url) — ver renderInline en public/widget.js).
      imageUrl?: string;
      // URL real de la ficha del producto en el sitio del prospecto — el
      // widget la renderiza como link normal si el modelo la incluye en su
      // respuesta ([texto](url), ya soportado).
      url?: string;
    }[];
    // Locale para el separador de miles del precio (default "es-CL" —
    // period como miles). Usar "es-MX" para pesos mexicanos, que usan coma
    // como miles (verificado contra el propio sitio: "$ 3,000.00 MXN").
    priceLocale?: string;
  };
  // Branding real del sitio del PROSPECTO, solo para /embed/demo (nunca se usa
  // en el chat en sí). Sin esto la página de demo se ve neutra; con esto usa
  // su logo/colores/imagen real para que la vista previa se sienta como su
  // propio sitio. Igual que `facts`: nunca inventar estos valores — sacarlos
  // inspeccionando el sitio real (DOM/CSS), no adivinarlos.
  demoBranding?: {
    primaryColor: string; // hex — color de marca principal (títulos/acentos)
    accentColor?: string; // hex — color secundario si el sitio tiene dos (se usa en el bubble del widget)
    logoUrl: string; // URL real del logo (hotlink al propio sitio del prospecto)
    heroImageUrl?: string; // URL real de una foto/banner de su sitio, de fondo
  };
}

const TENANTS: Record<string, EmbedTenant> = {
  // <nuevo-tenant-aquí> — no borres este comentario: `npm run embed-tenant -- --write` inserta acá.
  // Datos tomados de samsonite.com.mx (home, /pages/contacto, /pages/cambios-y-devoluciones,
  // /pages/politica-de-garantia, /pages/nuestras-tiendas, /collections/maletas-de-cabina)
  // el 2026-09-05 — prospecto importante, sitio aún no instalado. Plataforma: Next.js
  // headless + Builder.io para el sitio (NO Shopify, NO VTEX — /products.json devuelve
  // el HTML de fallback de Next), pero las FOTOS de producto sí están en Shopify Files
  // (cdn.shopify.com) — verificado el 2026-09-05: no hay tool de catálogo en vivo (sin
  // endpoint público que lo permita, mismo caso que saxoline-cl), así que usa
  // `demoStore` igual que ese tenant, con 10 maletas de cabina reales (nombre, color,
  // material, precio, foto e link, todo verificado) para que el asistente SÍ pueda
  // recomendar algo concreto con imagen y link — antes de esto (solo `facts` con
  // rangos de precio genéricos) no había ningún producto puntual que ofrecer, que fue
  // exactamente el problema reportado en vivo: preguntaron por una maleta de cabina
  // dura y rosada bajo $5,000 MXN y el asistente no pudo recomendar nada. Dato real
  // encontrado en esta pasada: NO existe una maleta de cabina rígida rosa en el
  // catálogo actual — la única rosa es blanda (Soft-Motion Biz) — así que el
  // catálogo de abajo incluye ese caso a propósito para que el asistente sea honesto
  // en vez de inventar una que no existe.
  "samsonite-mx": {
    id: "samsonite-mx",
    businessName: "Samsonite México",
    rubro: "tienda oficial de maletas, mochilas y accesorios de viaje",
    description:
      "House of Samsonite México — tienda oficial online de Samsonite, con despacho a todo México y retiro en tienda física. Bajo la misma tienda también vende American Tourister, Xtrem y Lipault.",
    facts: [
      "Marcas: Samsonite, American Tourister, Xtrem y Lipault, todas en la misma tienda.",
      "Categorías: Maletas (cabina, mediana, grande), Mochilas (laptop, escolares, urbanas), Bolsas, Accesorios (loncheras, estuches, candados, etc.) y Personalización (grabado de productos). También tienen colecciones de temporada (Regreso a Clases) y una sección Sale.",
      "Rangos de precio orientativos (MXN, varían con descuentos vigentes — NUNCA inventes el precio exacto de un modelo ni un % de descuento puntual; si preguntan por un producto específico, da el rango de su categoría e indícale que lo revise en el menú del sitio: Maletas, Mochilas, Bolsas o Accesorios):",
      "- Accesorios chicos (loncheras, estuches): aprox. $150 a $300 MXN.",
      "- Mochilas: aprox. $700 a $1,500 MXN.",
      "- Maletas de mano (cabina): aprox. $3,000 a $7,000 MXN.",
      "- Maletas medianas y grandes: aprox. $3,500 a $17,000 MXN, según colección (ej. C-Lite, Varro, Aerolux, Paralux, Horizons, Plume de Lipault).",
      "Excepción a lo anterior: para MALETAS DE CABINA sí tienes un catálogo real con nombre, color, material y precio de 10 modelos concretos (usa buscar_productos_demo) — para esa categoría específica, recomienda un producto puntual en vez del rango genérico.",
      "Envío: despacho a todo México, gratis en compras desde $5,000 MXN.",
      "Pago: hasta 6 meses sin intereses (MSI) en todo el sitio.",
      "Retiro en tienda: compra online y retira en tienda física en 24 horas (Click & Collect) — el sitio tiene un buscador de tiendas ('Encuentra una Tienda') para ver ubicaciones, nunca inventes una dirección puntual.",
      "Cambios y devoluciones: 30 días naturales desde la recepción del producto, sin uso, con etiquetas y empaque original. Las devoluciones de compras online se gestionan con la app REVERSSO desde el sitio (genera su propia guía de devolución). El reembolso SIEMPRE va al medio de pago original — nunca en efectivo, ni siquiera si el pedido se retiró en tienda —, con un plazo de gestión de 10 días hábiles una vez aprobada la solicitud.",
      "Garantía: cobertura internacional por defectos de fabricación (NO cubre mal uso, golpes, rayones, abrasión ni desgaste normal): Samsonite de 2 a 10 años según el modelo, Lipault 3 años, Xtrem 2 años.",
      "Servicio técnico (reparaciones bajo garantía): teléfono 55 4164 0513, email serviciotecnico.mexico@samsonite.com, o el Centro de Servicio Técnico en Av. Aquiles Serdán #400, Locales L104 y L104A, Col. Barrio Nextengo, Azcapotzalco, CP 02070, lunes a viernes de 9:00 a 17:00.",
      "Atención al cliente general: lunes a viernes de 9:00 a 18:00 hrs, teléfono +52 55 4164 0513. No hay WhatsApp publicado como canal de contacto — solo teléfono, el Centro de Ayuda del sitio y este chat.",
    ].join("\n"),
    model: "gemini-2.5-flash", // necesita llamar tools de verdad (buscar_productos_demo/agregar_al_carrito_demo)
    useEmojis: false, // marca global de viaje, tono corporate — sin emojis en las respuestas del modelo
    teaserMessage: "🧳 ¿Buscas la maleta o mochila ideal? ¡Pregúntame!", // solo aplica si openStyle vuelve a "bubble"
    // Demo de alto impacto para un prospecto importante: abre el chat solo al
    // cargar, como popup centrado — ver el comentario en la interfaz EmbedTenant
    // sobre por qué esto es para la demo, no necesariamente para la instalación real.
    openStyle: "popup",
    // Catálogo real de maletas de cabina, sacado de
    // /collections/maletas-de-cabina el 2026-09-05 (nombre, precio con
    // descuento vigente, capacidad/peso, color, material — hard/rígida salvo
    // que diga "blanda"). Fotos e links: hotlink real a Shopify Files
    // (cdn.shopify.com) y a la ficha real del producto — ambos verificados
    // con curl (200, imagen/página real) antes de usarlos, igual que
    // cualquier otro dato de este archivo. Sin priceLocale, "es-CL" formatea
    // 109990 como "109.990" — MAL para pesos mexicanos (el sitio real usa
    // coma: "$109,990.00") — por eso priceLocale: "es-MX" abajo.
    demoStore: {
      priceLocale: "es-MX",
      products: [
        {
          name: "Maleta Varro Spinner 55/20 Exp Black Cabina 35 Lts",
          price: 3000,
          description: "Samsonite, rígida, negra/azul, 40 L — antes $5,999",
          imageUrl: "https://cdn.shopify.com/s/files/1/0462/9499/1012/files/3489eb060b919c16c2bfb980e26b75f0870a724e7cc56011cfd28220f0fd1493.png",
          url: "https://samsonite.com.mx/products/maleta-varro-spinner-55-20-exp-black-cabina-35-lts",
        },
        {
          name: "Maleta de mano Aerolux plateada",
          price: 2999,
          description: "Samsonite, rígida, plateada, 40 L — antes $4,999",
          imageUrl: "https://cdn.shopify.com/s/files/1/0462/9499/1012/files/12739d6e60637a9941e097450052ba378c580630f193839e67939cdeda7dab23.jpg",
          url: "https://samsonite.com.mx/products/maleta-mano-aerolux-plateada",
        },
        {
          name: "Maleta de mano Aerolux negra",
          price: 2999,
          description: "Samsonite, rígida, negra, 40 L — antes $4,999",
          imageUrl: "https://cdn.shopify.com/s/files/1/0462/9499/1012/files/bac7ceec95633475c7481eea686f2c74d11e991364c345bd544cdaf4f2963121.jpg",
          url: "https://samsonite.com.mx/products/maleta-mano-aerolux-negra",
        },
        {
          name: "Maleta de mano Paralux negra",
          price: 6299,
          description: "Samsonite, rígida, negra, 40 L — antes $8,999",
          imageUrl: "https://cdn.shopify.com/s/files/1/0462/9499/1012/files/8010ac2d93c85c2916bdd0277c37170876b22ed605cb9ed76c1c57a1749f219a.png",
          url: "https://samsonite.com.mx/products/maleta-mano-paralux-negra",
        },
        {
          name: "Maleta de mano Paralux gris",
          price: 6299,
          description: "Samsonite, rígida, gris, 40 L — antes $8,999",
          imageUrl: "https://cdn.shopify.com/s/files/1/0462/9499/1012/files/b51972f9c1ef545bdfb5bbad292a3a05169c0d6ae3b28e3b305de973d7cff5c7.png",
          url: "https://samsonite.com.mx/products/maleta-mano-paralux-gris",
        },
        {
          name: "Maleta de mano Paralux azul",
          price: 6299,
          description: "Samsonite, rígida, azul, 40 L — antes $8,999",
          imageUrl: "https://cdn.shopify.com/s/files/1/0462/9499/1012/files/9469da81e69d33f1c5530a87e6f51dc19d3db6f16b075b552385096ba8714c4c.jpg",
          url: "https://samsonite.com.mx/products/maleta-mano-paralux-azul",
        },
        {
          name: "Maleta de mano Paralux verde",
          price: 6299,
          description: "Samsonite, rígida, verde, 40 L — antes $8,999",
          imageUrl: "https://cdn.shopify.com/s/files/1/0462/9499/1012/files/f60ce4a3b14d5684c43a903c2dade8750ad1fdc67a5123b62cbf32d079c109db.jpg",
          url: "https://samsonite.com.mx/products/maleta-mano-paralux-verde",
        },
        {
          name: "Maleta de mano Airshock EXP morada",
          price: 2999,
          description: "Samsonite, blanda, morada, 40 L — antes $4,999",
          imageUrl: "https://cdn.shopify.com/s/files/1/0462/9499/1012/files/fb6b9bbea2a8459b72bd7664352a7c5da07437940ce4aeeff23ac0465dd3d2a7.jpg",
          url: "https://samsonite.com.mx/products/maleta-mano-airshock-exp-morada",
        },
        {
          // Única maleta de cabina rosa del catálogo actual — y es BLANDA, no
          // rígida. No inventar una versión rígida rosa que no existe: si
          // preguntan por "dura y rosada", esta es la respuesta honesta más
          // cercana (rosa, no rígida), no una alternativa a inventar.
          name: "Maleta de mano Soft-Motion Biz rosada",
          price: 3849,
          description: "Samsonite, blanda (NO rígida), rosada, 35 L — antes $5,499",
          imageUrl: "https://cdn.shopify.com/s/files/1/0462/9499/1012/files/8059fb3be3c8fffc616e7f0f2804b9fa7e3af331701f8c3a131741f43cbdd7a4.jpg",
          url: "https://samsonite.com.mx/products/maleta-mano-soft-motion-biz-rosada",
        },
        {
          name: "Maleta de Cabina Plume Khaki Chica",
          price: 3900,
          description: "Lipault, blanda, khaki, 36 L — antes $6,000",
          imageUrl: "https://cdn.shopify.com/s/files/1/0462/9499/1012/files/7bacac49f105e45181f36000199e81be0e98c4966448747081b2148aaadc1282.jpg",
          url: "https://samsonite.com.mx/products/maleta-de-cabina-plume-cabin-khaki",
        },
      ],
    },
    // Branding real sacado en vivo de samsonite.com.mx el 2026-09-05: azul del
    // botón "¡COMPRA AHORA!" (computed style, exacto). Logo y foto de hero NO
    // están hotlinkeados como en los demás tenants: el logo es un <svg> inline
    // (no una URL de imagen) y las URLs de imagen de Builder.io llevan
    // query-string firmado que el sandbox bloquea al leerlo desde JS — así que
    // se extrajeron ambos del DOM real (el path del SVG tal cual, recoloreado
    // al azul de marca real de arriba; la foto vía screenshot-crop del banner
    // "Mochilas Samsonite" de /collections/mochilas-samsonite, evergreen — no
    // el carrusel de home, que rota campañas fechadas como "Regreso a Clases
    // 2026") y quedaron self-hosted en public/embed-assets/.
    demoBranding: {
      primaryColor: "#1A41C1",
      logoUrl: "/embed-assets/samsonite-logo.svg",
      heroImageUrl: "/embed-assets/samsonite-hero.jpg",
    },
  },
  // Datos tomados de saxoline.cl (home, footer) el 2026-09-05 — prospecto,
  // sitio aún no instalado. Saxoline es de Samsonite Chile S.A. (misma
  // controladora que samsonite-mx arriba) y también vende Xtrem y Samsonite
  // en el mismo sitio. A diferencia de samsonite-mx, ACÁ SÍ hay Shopify real
  // detrás (cdn.shopify.com en sus assets, IDs "gid://shopify/ProductVariant/..."
  // en el request real de "agregar al carro"), pero headless: el "agregar al
  // carro" que capturamos en vivo (patchando window.fetch/XHR y haciendo clic
  // real) es un Server Action propio de su Next.js — POST a la misma URL de
  // la página, no a /cart/add.js — y no exponen ningún token de Storefront
  // API en el bundle del cliente. O sea: ni buildShopifyTools (necesita los
  // endpoints públicos clásicos) ni replicar su Server Action (privado,
  // cambia con cada deploy de ellos, no es una superficie pensada para
  // terceros) son un camino real. Por eso usa `demoStore`: catálogo curado a
  // mano con nombres/precios REALES vigentes hoy, concierge simulado — nunca
  // se presenta como ya conectado a su tienda real (ver buildDemoStoreTools
  // en lib/embed-tools.ts). Precios con descuento vigente al momento de
  // extraerlos — pueden cambiar con sus propias promociones, igual que
  // cualquier catálogo estático de este archivo.
  "saxoline-cl": {
    id: "saxoline-cl",
    businessName: "Saxoline",
    rubro: "tienda de maletas, mochilas y accesorios de viaje",
    description:
      "Saxoline — tienda chilena de maletas, mochilas, bolsos y accesorios de viaje, de Samsonite Chile S.A. En el mismo sitio también vende Xtrem y Samsonite.",
    facts: [
      "Marcas en el sitio: Saxoline (propia), Xtrem y Samsonite.",
      "Categorías: Novedades, Maletas, Mochilas, Bolsos, Carteras, Accesorios y Sale.",
      "Envío: despacho a todo Chile desde $3.990.",
      "Pago: hasta 6 cuotas sin interés en todo el sitio.",
      "Garantía: los productos Saxoline tienen 3 años de garantía local. Otras marcas del mismo sitio (Xtrem, Samsonite) tienen su propia garantía — no la inventes si preguntan, deriva a Servicio Técnico o Centro de Ayuda para confirmarla.",
      "Cambios y devoluciones: se puede pedir la anulación del pedido; si hubo un pago asociado, se devuelve el monto total. Cambios sin costo.",
      "Empresa: Samsonite Chile S.A., Casa Matriz Av. Manquehue Norte 160, Piso 12, Las Condes, Santiago.",
      "IMPORTANTE — esto es una DEMO/prueba de concepto para evaluar el asistente, no está instalado en su sitio real todavía: el catálogo de abajo es una muestra curada (nombres y precios reales al día de hoy), no el inventario en vivo, y 'agregar al carrito' es una simulación visual — nunca agrega a un carrito de verdad. Sé transparente sobre esto si preguntan.",
    ].join("\n"),
    model: "gemini-2.5-flash", // necesita llamar tools de verdad (buscar_productos_demo/agregar_al_carrito_demo)
    useEmojis: true, // tono más cercano/casual que samsonite-mx, acorde a la marca (copy propio: "Va con todo")
    teaserMessage: "🧳 ¿Buscas tu próxima maleta o mochila? ¡Pregúntame!",
    demoStore: {
      products: [
        { name: "Maleta de cabina Odyssey negra", price: 109990, description: "Samsonite, 40 L, 2.3 kg — antes $159.990" },
        { name: "Maleta grande On-Track negra", price: 89990, description: "Saxoline, 100 L, 4.3 kg — antes $119.990" },
        { name: "Maleta grande Argenta Impact Pro rosada", price: 95990, description: "Saxoline, 108 L, 4.2 kg — antes $125.990" },
        { name: "Maleta grande Chrome Impact Pro amarilla", price: 99990, description: "108 L, 4.3 kg — antes $129.990" },
        { name: "Maleta Vancouver Sx Spinner 28 Black L 102 Lts", price: 95990, description: "Saxoline, 102 L, 4 kg — antes $125.990" },
        { name: "Mochila de viaje Nomad azul", price: 59990, description: "Saxoline, 35 L, 1.2 kg" },
        { name: "Mochila de viaje Reynold negra", price: 55990, description: "Xtrem, 38 L, 0.9 kg" },
        { name: "Mochila de viaje Quator 2.0 negra", price: 42990, description: "Xtrem, 38 L, 0.9 kg" },
        { name: "Mochila PRESTON 5SX Marine Blue M", price: 17990, description: "Saxoline, 35 L, 0.45 kg — antes $29.990" },
      ],
    },
    // Branding real sacado en vivo de saxoline.cl el 2026-09-05: negro del
    // botón "AGREGAR AL CARRO" (computed style). Logo y foto self-hosted en
    // public/embed-assets/ por el mismo motivo que samsonite-mx: el logo es
    // un <svg> inline (recoloreado al negro real de arriba) y las imágenes de
    // Builder.io llevan query-string firmado que el sandbox bloquea leer
    // desde JS — la foto es un screenshot-crop de la mitad SIN texto/fecha
    // del banner de categoría de /collections/mochilas (un flat-lay de
    // mochilas, evergreen; la otra mitad del mismo banner tenía un "30% OFF
    // hasta el 2 de septiembre" fechado, descartado a propósito).
    demoBranding: {
      primaryColor: "#1C1C1C",
      logoUrl: "/embed-assets/saxoline-logo.svg",
      heroImageUrl: "/embed-assets/saxoline-hero.jpg",
    },
  },
  // Datos tomados de premiumdental.cl (home, /tratamientos-dentales, /tienda,
  // /contacto) el 2026-09-01 — prospecto, sitio aún no instalado. Sin sistema
  // de reservas propio: el sitio real solo deriva a WhatsApp/contacto ("Agenda
  // tu evaluación hoy mismo" abre el contacto, no un calendario) — este chat
  // tampoco agenda directo, junta los datos y usa registrar_contacto. Precios
  // reales publicados SOLO para las 4 ofertas de /tienda; el resto de
  // tratamientos no tiene precio público — nunca inventarlo.
  "premium-dental": {
    id: "premium-dental",
    businessName: "Premium Dental",
    rubro: "clínica dental",
    description:
      "Premium Dental — clínica dental en Santiago Centro, acreditada por la SEREMI de Salud. Atiende endodoncia, extracciones, ortodoncia, odontopediatría, prostodoncia, periodoncia y cirugía oral y maxilofacial.",
    facts: [
      "Especialidades: Endodoncia, Extracciones, Ortodoncia, Odontopediatría, Prostodoncia, Periodoncia, Cirugía Oral y Maxilofacial. También atiende urgencias dentales.",
      "Ofertas con precio publicado (CLP):",
      "- Tapaduras Dentales — desde $35.000",
      "- Carillas Dentales — desde $64.900",
      "- Prótesis Dental — desde $275.000",
      "- Implante Dental + Corona — oferta $655.000 (antes $850.000)",
      "Otros tratamientos (blanqueamiento dental, limpieza dental, brackets/ortodoncia, combos blanqueamiento+limpieza) NO tienen precio publicado — nunca lo inventes, indica que se cotiza en la evaluación.",
      "Horario: Lunes a viernes 09:00 a 18:00, sábado 09:00 a 14:00.",
      "Ubicación: Moneda 812, oficina 1003, Santiago Centro (Región Metropolitana).",
      "Contacto: WhatsApp +56 9 2050 5996, email servicios@premiumdental.cl, Instagram @premiumdental.cl.",
      "Acreditada por la SEREMI de Salud.",
      "El sitio no tiene sistema de reservas propio: 'Agenda tu evaluación hoy mismo' deriva a contacto/WhatsApp, no a un calendario. Este chat tampoco agenda directo — si alguien quiere hora, junta nombre, teléfono y el tratamiento de interés, y usa registrar_contacto (o indícale el WhatsApp si prefiere escribir directo).",
    ].join("\n"),
    whatsapp: "56920505996",
    ownerNotifyEmail: "servicios@premiumdental.cl",
    model: "gemini-3.5-flash-lite", // solo conversa + deriva, sin tools de agenda/tienda
    useEmojis: true,
    teaserMessage: "🦷 ¿Dudas sobre tu tratamiento? ¡Escríbeme!",
    // Colores e imágenes sacados en vivo de premiumdental.cl (computed styles
    // + zoom sobre los botones reales) el 2026-09-01: morado del botón
    // "Contáctanos" del header, verde-salvia del botón "Contáctanos" del
    // hero, logo y banner tal cual los sirve su propio sitio (WordPress).
    demoBranding: {
      primaryColor: "#6A4790",
      accentColor: "#6BAF90",
      logoUrl: "https://premiumdental.cl/wp-content/uploads/2024/08/cropped-ryf-1000-x-170-px-600-x-170-px-10-171x62.webp",
      heroImageUrl: "https://premiumdental.cl/wp-content/uploads/2024/08/dentistas-banner-inicio-dentalpremium.webp",
    },
  },
  // Datos tomados de boutiquedentalmontemar.cl el 2026-08-31 — prospecto,
  // sitio aún no instalado. Reservan por Dentalink (link real "Agenda cita
  // online" del sitio apunta a softwaredentalink.com): este asistente NO
  // agenda directo (sin tool de agenda), responde con la info real y deriva
  // al botón de agenda online o a WhatsApp. Sin precios publicados (clínica
  // "boutique", cotiza caso a caso) — no inventarlos.
  "boutique-dental-montemar": {
    id: "boutique-dental-montemar",
    businessName: "Boutique Dental Montemar",
    rubro: "clínica dental boutique",
    description:
      "Boutique Dental Montemar — la primera boutique dental de la Región de Valparaíso, en Concón/Viña del Mar. Salud bucal y estética integradas, en un espacio pensado para que la visita al dentista sea una experiencia cómoda.",
    facts: [
      "Áreas de atención: Rehabilitación oral e Implantología; Estética facial (rinomodelación, toxina botulínica, perfilado/aumento de labios, rejuvenecimiento facial, armonización orofacial); Tratamientos dentales (ortodoncia, cirugía bucal, endodoncia, odontología general, periodoncia).",
      "Sin precios publicados — es una clínica boutique que cotiza cada tratamiento según el caso; nunca inventes un precio, indica que se evalúa en la primera consulta.",
      "Horario: lunes a viernes de 09:00 a 19:00, sábados de 09:00 a 14:00.",
      "Ubicación: Av. Bosques de Montemar 30, Edificio Soho Montemar, Oficina 315 (Concón/Viña del Mar). Estacionamientos privados para pacientes.",
      "Contacto: WhatsApp +56 9 6487 6300, teléfono +56 32 380 5357, email info@boutiquedentalmontemar.cl, Instagram @boutiquedentalmontemar.",
      "Las reservas se hacen en su agenda online (Dentalink) o por WhatsApp — este chat NO agenda directo: si alguien quiere hora, indícale que use el botón \"Agenda cita online\" del sitio o escriba por WhatsApp, y usa registrar_contacto si prefiere que el equipo lo contacte.",
    ].join("\n"),
    whatsapp: "56964876300",
    ownerNotifyEmail: "info@boutiquedentalmontemar.cl",
    model: "gemini-3.5-flash-lite", // solo conversa + deriva, sin tools de agenda/tienda
    useEmojis: true,
  },
  // Datos tomados de odontoplus.cl (incl. su tienda online, con precios
  // reales publicados) el 2026-08-31 — prospecto, sitio aún no instalado.
  // Sin tool de agenda: "Agendar" y "Urgencia Dental" del sitio real ya
  // apuntan directo a WhatsApp (no tienen sistema de reservas propio), así
  // que el asistente solo responde con el catálogo real y deriva a WhatsApp.
  // Horario de atención NO está publicado en el sitio: no inventarlo.
  "odontoplus": {
    id: "odontoplus",
    businessName: "OdontoPlus",
    rubro: "clínica dental y estética",
    description:
      "OdontoPlus — clínica dental y estética con dos sucursales (Viña del Mar y Quilpué). Atiende implantes dentales, ortodoncia, odontología general y estética, además de estética facial y corporal.",
    facts: [
      "Áreas de atención: Implantes Dentales, Ortodoncia, Odontología General, Odontología Estética, Estética Facial, Estética Corporal, y Urgencia Dental.",
      "Precios reales publicados (CLP):",
      "- Limpieza dental — $35.000",
      "- Blanqueamiento Dental — $49.990",
      "- Carillas Dentales — $450.000",
      "- Cuota de Implante — $85.625",
      "- Cuota Implante Dental — $99.997",
      "- Pie de cirugía de implante — $390.000",
      "- Presupuesto cirugía de implante — $1.450.000",
      "- Criolipólisis 4 zonas — $119.990",
      "- Depilación Láser Cuerpo Completo — $380.000",
      "- Hifu 12D rostro completo + cuello + papada + bb glow — $119.990",
      "- Hifu 25D rostro completo + cuello + papada — $169.990",
      "- Hifu Papada — $49.990",
      "- Hilos Tensores — $430.000",
      "- Limpieza facial premium — $39.990",
      "- Limpieza facial premium + peeling — $45.000",
      "- Rinomodelación — $199.990",
      "- Sculptra — $419.990",
      "- Toxina 3 zonas — $169.990",
      "- Plasma rico en plaquetas 3 sesiones — $159.990",
      "Sucursales:",
      "- Viña del Mar: 10 Norte 746. WhatsApp +56 9 6836 3309.",
      "- Quilpué: Balmaceda 238, local 7. WhatsApp +56 9 8963 8008.",
      "El horario de atención NO está publicado — nunca lo inventes; si preguntan, indica que se confirma al agendar.",
      "El sitio no tiene sistema de reservas propio: 'Agendar' y 'Urgencia Dental' derivan directo a WhatsApp. Este chat tampoco agenda directo — si alguien quiere hora, junta nombre, teléfono, el tratamiento de interés y su sucursal preferida (Viña del Mar o Quilpué), y usa registrar_contacto o indícale el WhatsApp de esa sucursal.",
    ].join("\n"),
    whatsapp: "56968363309",
    model: "gemini-3.5-flash-lite", // solo conversa + deriva, sin tools de agenda/tienda
    useEmojis: true,
  },
  // Datos tomados de mapubarbershop.cl y @mapubarber el 2026-08-31 —
  // prospecto, sitio aún no instalado. Las reservas reales las procesa
  // Luar System (externo, botón "Reservar" del sitio): este asistente NO
  // agenda directo (no hay tool de agenda), solo responde con el catálogo
  // real y deriva a "Reservar" o a WhatsApp para agendar.
  "mapu-barber-shop": {
    id: "mapu-barber-shop",
    businessName: "Mapu Barber Shop",
    rubro: "barbería",
    description:
      "Mapu Barber Shop — barbería premium fundada en 2017 en Valparaíso, con dos sucursales en la región (Valparaíso y Viña del Mar).",
    facts: [
      "Servicios y precios (CLP, IVA incluido):",
      "- Corte de Cabello (45 min): corte con máquina y tijera, lavado y styling — $18.600",
      "- Corte Precisión 100% Tijeras (1h) — $25.000",
      "- Cambio de Look (1h 15min): transformación completa con asesoría — $27.000",
      "- Corte y Mantención Cabello Largo (1h) — $24.000",
      "- Corte + Lavado Premium (45 min) — $22.000",
      "- Perfilado de Barba Simple (35 min) — $16.500",
      "- Perfilado de Barba con Navaja (45 min): protocolo clásico con paños calientes y fríos — $18.600",
      "- Rasurado Completo de Barba (45 min) — $22.000",
      "- Combo Corte + Perfilado Barba Simple (1h) — $28.000",
      "- Combo Corte + Perfilado Barba Navaja (1h 15min) — $30.000",
      "- Combo Corte + Rasurado Completo Barba (1h 15min) — $34.000",
      "- Combo Rasurado Completo + Perfilado Navaja (1h 15min) — $35.000",
      "- Combo Rasurado Completo + Perfilado Simple (1h) — $32.500",
      "Sucursales y horario (ambas Lunes a Sábado 10:00-20:00):",
      "- Viña del Mar: 1 Oriente 876. WhatsApp +56 9 3671 7496.",
      "- Valparaíso: Calle Blanco 974, Local 01. WhatsApp +56 9 4919 3694.",
      "Instagram: @mapubarber.",
      "Las reservas se hacen en la plataforma de reservas del sitio (botón \"Reservar\") o por WhatsApp de la sucursal — este chat NO agenda directo: si alguien quiere hora, indícale el botón \"Reservar\" del sitio o el WhatsApp de la sucursal que le quede más cerca, y usa registrar_contacto si prefiere que el equipo lo contacte.",
    ].join("\n"),
    whatsapp: "56936717496",
    model: "gemini-3.5-flash-lite", // solo conversa + deriva, sin tools de agenda/tienda
    useEmojis: true,
  },
  // Datos tomados de fuxiaginecologia.cl y @fuxiaginecologia (Instagram) el
  // 2026-08-30 — prospecto, sitio aún no instalado. Horarios y precios NO están
  // publicados en ninguna de las dos fuentes: no inventar, confirmar con el
  // negocio antes de ir a producción.
  "fuxia-ginecologia": {
    id: "fuxia-ginecologia",
    businessName: "Fuxia Ginecología",
    rubro: "clínica de ginecología estética y funcional",
    description:
      "Fuxia Ginecología — Incontinencia & Hormonas, dirigida por el Dr. Anzorena. Especialistas en salud femenina: incontinencia urinaria, terapia hormonal bioidéntica y procedimientos ginecológicos estéticos y funcionales.",
    facts: [
      "Servicios: tratamiento de incontinencia urinaria, terapia hormonal bioidéntica, láser CO2 vaginal (reafirmación vaginal), armonización vulvar, labioplastia genital, reemplazo hormonal, atención por telemedicina, y otros procedimientos ginecológicos estéticos.",
      "Acreditada y autorizada por el SEREMI de Salud en Viña del Mar.",
      "Ubicación: Av. Concón-Reñaca #4000, OF 1602, Concón, Chile. También atiende por telemedicina para quien no pueda ir presencial.",
      "Contacto: WhatsApp +56 9 9179 5569, email info.fuxia@gmail.com, Instagram @fuxiaginecologia.",
      "Horarios de atención y precios NO están publicados — nunca los inventes. Si preguntan, indica que se confirman al coordinar la hora.",
      "Las horas se agendan por Doctoralia/AgendaPro (fuera de este chat, no dentro): cuando alguien quiera agendar, junta nombre, teléfono, el servicio de interés y el día/horario que prefiere, y usa registrar_contacto — el equipo de la clínica confirma el cupo real en su agenda y le escribe para cerrarlo. Nunca digas que una hora quedó agendada — solo que se tomó su solicitud y la confirman a la brevedad.",
    ].join("\n"),
    whatsapp: "56991795569",
    ownerNotifyEmail: "info.fuxia@gmail.com",
    // flash (no lite): registrar_contacto debe ejecutarse de verdad cuando junte
    // los datos, no solo "confirmar" en texto sin llamar la tool (visto en vivo
    // con -lite en flujos de reserva) — clínica real, no vale arriesgarlo.
    model: "gemini-2.5-flash",
  },
  // Datos tomados de yukipet.cl el 2026-09-01 — prospecto, sitio aún no
  // instalado. Prototipo del "concierge de tienda" (lib/embed-shopify.ts):
  // busca en el catálogo Shopify EN VIVO y agrega al carrito real de la
  // visita — sin token, endpoints públicos de Shopify. Verificado contra la
  // tienda real (búsqueda y ficha de producto); el agregado al carrito solo
  // funciona de verdad una vez instalado en yukipet.cl (same-origin).
  yukipet: {
    id: "yukipet",
    businessName: "Yuki Pet",
    rubro: "tienda online de productos para perros (caja de suscripción mensual)",
    description:
      "Yuki Pet — Yuki Box, una caja mensual temática para perros con juguetes y snacks premium personalizados. Más de 3.500 cajas enviadas en Chile. También vende juguetes, snacks y merchandising por separado.",
    facts: [
      "Yuki Box: suscripción mensual desde $19.990/mes, se cancela cuando quieras. Caja temática distinta cada mes (no se repite), con juguetes y snacks premium.",
      "También se venden juguetes, snacks y dijes coleccionables por separado — usa buscar_productos para catálogo y precios reales, nunca los inventes.",
      "Envío gratis a todo Chile (Blue Express).",
      "Instagram y TikTok: @yukipet.cl.",
      "Para dudas de una suscripción ya activa (cambiar dirección, pausar, cancelar), deriva a WhatsApp: el chat no gestiona suscripciones existentes.",
    ].join("\n"),
    whatsapp: "56987231647",
    model: "gemini-2.5-flash", // necesita llamar tools de verdad (buscar_productos/agregar_al_carrito), no solo conversar
    useEmojis: true,
    shopify: { domain: "yukipet.cl" },
    teaserMessage: "🐶 ¿Buscas algo para tu perrito? ¡Pregúntame!",
    // Branding sacado en vivo de yukipet.cl (computed styles) el 2026-09-01:
    // azul y rojo de los botones del hero, fondo crema del sitio, logo y una
    // foto real de una Yuki Box (evergreen, no depende de una campaña puntual).
    demoBranding: {
      primaryColor: "#0B4EDB",
      accentColor: "#DE1515",
      logoUrl: "https://yukipet.cl/cdn/shop/files/Yuki_Pet__N.png",
      heroImageUrl: "https://yukipet.cl/cdn/shop/files/TEMATICA_CARRUSEL_LANDING_4.png",
    },
  },
  // Datos tomados de auramay.cl el 2026-09-01 — prospecto, sitio aún no
  // instalado. Mismo prototipo de concierge de tienda que yukipet, tono más
  // sobrio (dermocosmética premium, sin emojis) acorde a la marca real.
  auramay: {
    id: "auramay",
    businessName: "Aura May",
    rubro: "dermocosmética natural para piel sensible",
    description:
      "Aura May — dermocosmética chilena para pieles sensibles, con ingredientes naturales (ácido hialurónico, aloe vera, jojoba, rosa mosqueta). Productos veganos, cruelty-free y testados dermatológicamente.",
    facts: [
      "Línea de productos: agua micelar (Laguz), crema de día (Uruz), crema/mascarilla de noche (Perth), aceite facial (Fehu), y rutinas en pack — usa buscar_productos para catálogo, precios y stock reales, nunca los inventes.",
      "Envío gratis sobre $29.990. Entrega 24-48h en Santiago, 2-4 días hábiles en regiones.",
      "Ofrecen asesoría gratuita con cosmetóloga: si alguien quiere recomendación personalizada según su tipo de piel, junta su nombre, teléfono y qué le pasa a su piel, y usa registrar_contacto.",
      "Instagram: @auramay.cl.",
    ].join("\n"),
    model: "gemini-2.5-flash",
    useEmojis: false,
    shopify: { domain: "auramay.cl" },
    teaserMessage: "✨ ¿Dudas sobre tu rutina de piel? Pregúntame",
    // Branding sacado en vivo de auramay.cl (computed styles) el 2026-09-01:
    // negro real del botón "Comprar rutina" (sin accentColor — el otro color
    // de marca es un amarillo muy pálido, mal contraste para el ícono blanco
    // del botón del widget), logo, y una foto evergreen del "Pack Quatro" (NO
    // el banner de la campaña "BlackAura" del home, que vence el 2026-09-02).
    demoBranding: {
      primaryColor: "#1B1917",
      logoUrl: "https://auramay.cl/cdn/shop/files/AURAmay_LOGO.png",
      heroImageUrl: "https://auramay.cl/cdn/shop/files/ChatGPT_Image_6_ago_2026_03_30_52_p.m..png",
    },
  },
  // Tenant de demostración (Nails Color — design partner del MVP del add-on).
  // Datos placeholder: reemplazar por precios/horarios reales antes de usar en frío.
  demo: {
    id: "demo",
    businessName: "Nails Color",
    rubro: "salón de uñas y pestañas",
    description:
      "Salón de manicure, pedicure y pestañas en Villa Alemana. Atiende con reserva; se puede dejar una seña para asegurar la hora.",
    facts: [
      "Servicios: manicure tradicional, esmaltado permanente, kapping, soft gel, pedicure spa, lifting y extensiones de pestañas.",
      "Horario referencial: martes a sábado de 10:00 a 19:00 (placeholder — confirmar).",
      "Las reservas se aseguran con una seña; el resto se paga en el salón (placeholder).",
      "Ubicación: Villa Alemana (Pje. Brasilia 150).",
    ].join("\n"),
    whatsapp: "56900000000",
    model: "gemini-2.5-flash",
    useEmojis: true,
    agenda: {
      services: [
        "Manicure tradicional",
        "Esmaltado permanente",
        "Kapping",
        "Soft gel",
        "Pedicure spa",
        "Lifting de pestañas",
        "Extensiones de pestañas",
      ],
      hours: [
        { day: "Martes a sábado", open: "10:00", close: "19:00" },
        { day: "Domingo", closed: true },
        { day: "Lunes", closed: true },
      ],
      slotMinutes: 60,
      daysAhead: 14,
    },
    store: {
      products: [
        { slug: "gift-card-20000", name: "Gift Card $20.000", price: 20000, category: "Gift cards", description: "Tarjeta de regalo canjeable por servicios." },
        { slug: "kit-cuidado-unas", name: "Kit de cuidado de uñas en casa", price: 14990, category: "Productos", description: "Aceite de cutícula, lima y crema de manos." },
        { slug: "esmalte-premium", name: "Esmalte premium (unidad)", price: 6990, category: "Productos", description: "Esmalte de larga duración." },
      ],
      shippingNote: "Retiro en el salón (Villa Alemana) o despacho a coordinar por WhatsApp.",
    },
  },
};

export function getEmbedTenant(id: string | null | undefined): EmbedTenant | null {
  if (!id) return null;
  return TENANTS[id] ?? null;
}

export function buildEmbedSystemPrompt(t: EmbedTenant): string {
  return [
    `Eres el asistente virtual de "${t.businessName}" (${t.rubro}).`,
    t.description,
    `Información del negocio (respondé SOLO con esto; no inventes precios, horarios ni servicios que no estén aquí):`,
    t.facts,
    t.agenda || t.externalAgenda
      ? `TÚ PUEDES AGENDAR DIRECTAMENTE en esta conversación usando tus herramientas. Hoy es ${new Intl.DateTimeFormat(
          "es-CL",
          { timeZone: "America/Santiago", weekday: "long", year: "numeric", month: "long", day: "numeric" }
        ).format(new Date())} (${new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago" }).format(
          new Date()
        )}); resuelve tú las fechas relativas ("el próximo martes") a formato YYYY-MM-DD sin pedírselas al cliente. Flujo: 1) pregunta qué servicio quiere; 2) usa consultar_disponibilidad para ofrecer 2-3 horarios REALES (nunca inventes horarios); 3) pide nombre y teléfono; 4) en cuanto tengas servicio, fecha, hora, nombre y teléfono, llama de inmediato a crear_reserva —no pidas confirmaciones extra ni preguntes si ya consultó disponibilidad, el servidor valida la hora—. Si crear_reserva devuelve error, ofrece otro horario. NUNCA digas que una hora quedó reservada sin que crear_reserva haya respondido ok.${
          t.agenda ? ` Servicios reservables: ${t.agenda.services.join(", ")}.` : ""
        }`
      : ``,
    t.store && t.store.products.some((p) => p.available !== false)
      ? `El negocio tiene TIENDA y puedes armar el pedido en la conversación. Productos (menciona precio, recomienda según lo que busque):\n${t.store.products
          .filter((p) => p.available !== false)
          .map((p) => `- ${p.name} [slug: ${p.slug}]: $${p.price.toLocaleString("es-CL")}${p.category ? ` (${p.category})` : ""}${p.description ? ` — ${p.description}` : ""}`)
          .join("\n")}\nCuando el cliente elija productos y cantidades y te dé nombre y teléfono, llama a crear_pedido —te devuelve el total REAL y un link de pago Webpay que debes entregarle tal cual. Nunca calcules el total tú ni inventes productos: solo slugs del catálogo. Si crear_pedido devuelve error, corrígelo con el cliente.`
      : ``,
    t.shopify
      ? `Eres además el CONCIERGE de la tienda. Si preguntan en general qué venden o qué líneas de productos tienen (sin pedir un producto puntual), responde directo con las líneas que ya están en la información del negocio de arriba — NO llames ninguna tool para eso, así respondes al instante; ahí mismo ofrece buscar el precio o stock exacto de la que le interese. Solo cuando busquen o pidan un producto puntual (un tipo, una necesidad concreta, o quieran el precio/stock real antes de recomendar o agregar algo), usa buscar_productos UNA vez con esa consulta puntual (catálogo en vivo, nunca inventes productos, precios ni stock) — no la llames varias veces seguidas para armar tú un listado completo. Cuando recomiendes uno y la persona quiera agregarlo, usa agregar_al_carrito con el handle exacto que te devolvió buscar_productos — la respuesta trae un botón que debes incluir TAL CUAL, en su propia línea, en tu mensaje (no lo reescribas ni lo describas, el widget lo convierte en un botón real de "agregar al carrito"). Si el producto tiene más de una variante (talla, color), pregunta cuál antes de agregar.`
      : ``,
    t.demoStore
      ? `Eres además el CONCIERGE de la tienda, pero en modo DEMO/prueba de concepto para este prospecto — no está conectado a su tienda real todavía. Usa buscar_productos_demo cuando busquen o pidan un producto puntual (catálogo curado, precios reales al día de hoy pero no en vivo). Si la persona da tipo, color y/o presupuesto, pon el tipo/color en "consulta" y el monto en "precioMaximo" — es un filtro real del servidor, no lo calcules tú de memoria. Con el resultado, RECOMIENDA UN PRODUCTO ESPECÍFICO (nombre y precio) que calce con lo que pidió — nunca respondas listando todo el catálogo genéricamente ni digas que "no puedes recomendar" cuando la tool sí te devolvió opciones. Si la nota indica que no hay nada bajo su presupuesto, dilo con honestidad y ofrece la alternativa más cercana; si nada calza exactamente en color o material (ej. piden "rígida y rosa" pero solo hay una rosa blanda), dilo tal cual — nunca inventes una variante que no está en los resultados. Cuando un producto tenga "imagenUrl", inclúyela SIEMPRE en tu respuesta como imagen markdown (![nombre del producto](imagenUrl)) para que la vea — y si tiene "link", agrega también "[Ver en el sitio](link)" en su propia línea. Cuando recomiendes uno y quieran agregarlo, usa agregar_al_carrito_demo — la respuesta trae un botón que debes incluir TAL CUAL, en su propia línea (el widget lo convierte en un botón que simula el agregado, sin tocar ningún carrito real). Si preguntan directamente si esto ya compra de verdad o si es real, sé honesto: es una demostración de cómo se vería el asistente instalado en su sitio, no una integración activa todavía.`
      : ``,
    `Cuando la persona quiera cotizar o que la contacten (y no sea reserva de agenda ni compra de tienda): pídele su nombre y su teléfono (y email si lo tiene), y en cuanto te los dé, usa la tool registrar_contacto para avisar al negocio. Nunca inventes esos datos; úsalos tal como los entregó.`,
    t.whatsapp
      ? `Si no sabes algo, o si la persona prefiere hablar con una persona ahora, indícale amablemente que escriba por WhatsApp al +${t.whatsapp}.`
      : `Si no sabes algo, indícalo con honestidad y ofrece tomar sus datos con registrar_contacto para que le respondan.`,
    "Formato de tus respuestas: si enumeras varios servicios o precios usa viñetas ('- '), y destaca precios o nombres de servicios con **negrita** — el widget los muestra ya formateados. No uses encabezados (#), tablas ni bloques de código: no se ven bien en el widget.",
    t.useEmojis
      ? "Puedes usar 1-2 emojis por respuesta cuando aporten calidez (ej. 😊 ✨ 📅), sin exagerar ni ponerlos en cada frase."
      : "No uses emojis en tus respuestas.",
    "Responde siempre en español, breve, cálido y profesional. Máximo 2-3 frases por respuesta y cierra con una pregunta o el siguiente paso. Nunca inventes información que no esté arriba.",
  ]
    .filter(Boolean)
    .join("\n\n");
}
