import type { BrandKey as CatalogBrand } from "@/lib/mandagroup-catalog";

// Páginas propias de cada marca (/restaurantes/… y /clubes/…): son las que
// Google y los asistentes de IA pueden mostrar cuando alguien busca "parrilla
// en Reñaca", "sushi en Curauma" o "fiestas en Viña" — la home sola compite
// por "Manda Group", no por cada rubro. Acá va solo el texto fijo y
// verificable de cada marca; direcciones y canales de reserva salen de los
// locales del panel (lib/mandagroup-catalog) y las fechas, de la cartelera.
//
// Nada de horarios, precios ni platos inventados: lo que no está confirmado
// no se publica (un asistente de IA lo repetiría como cierto).

export type BrandPageKey = "renaca" | "vina" | "carbon" | "costa";

export interface BrandPage {
  key: BrandPageKey; // = BRANDS[].key en lib/mandagroup-brands
  section: "restaurantes" | "clubes";
  slug: string;
  catalogBrand: CatalogBrand; // marca de sus locales y cartas en el panel
  localIds?: string[]; // si la marca comparte catalogBrand con otra (Manda)
  schemaType: "Restaurant" | "NightClub";
  name: string; // como se escribe la marca
  alternateName?: string[];
  cuisine?: string[];
  title: string; // <title>, ~60 caracteres
  description: string; // meta description, ~155 caracteres
  h1: string;
  eyebrow: string;
  // Primer párrafo: la respuesta directa a "¿qué es X y dónde está?", en
  // 40–60 palabras (lo que un buscador o asistente cita tal cual).
  intro: string;
  highlights: { title: string; body: string }[];
  faq: { q: string; a: string }[];
  // Carta: "public" enlaza a sus cartas públicas; "qr" explica que se ve en el
  // local (Carbon: precios distintos para turistas, ver mandagroup-catalog).
  menu: "public" | "qr";
  eventsTitle: string;
}

const DRESS_CODE =
  "No se permite pantalón cargo o jogger, lentes de sol, short, bananos, ropa deportiva ni buzos, cadenas a la vista, poleras sin mangas ni sandalias. Quien no lo cumpla puede tener que retirarse de la fiesta.";

export const BRAND_PAGES: BrandPage[] = [
  {
    key: "carbon",
    section: "restaurantes",
    slug: "carbon",
    catalogBrand: "carbon",
    schemaType: "Restaurant",
    name: "Carbón",
    alternateName: ["Carbon", "Carbón Reñaca", "Carbon Chile"],
    cuisine: ["Parrilla", "Carnes"],
    title: "Carbón Reñaca | Parrilla, carnes y shows en vivo",
    description:
      "Carbón es la parrilla de Manda Group en Av. Central 184, Reñaca: cortes de carne a la parrilla, coctelería y noches con shows en vivo. Mira los próximos shows.",
    h1: "Carbón, parrilla y carnes en Reñaca",
    eyebrow: "Restaurante · Reñaca",
    intro:
      "Carbón es el restaurante de carnes y parrilla de Manda Group, en Av. Central 184, Reñaca (Viña del Mar). Cortes a la parrilla, coctelería y noches con shows en vivo: una mesa para comer bien y quedarse a la música.",
    highlights: [
      { title: "Carnes a la parrilla", body: "La especialidad de la casa: cortes de carne preparados a la parrilla." },
      { title: "Coctelería", body: "Barra con cócteles para acompañar la comida o seguir la noche." },
      { title: "Shows en vivo", body: "Noches con artistas en vivo y cena, con entradas a la venta en Vesti." },
    ],
    faq: [
      {
        q: "¿Dónde está Carbón?",
        a: "Carbón está en Av. Central 184, Reñaca, comuna de Viña del Mar, Región de Valparaíso.",
      },
      {
        q: "¿Qué tipo de comida tiene Carbón?",
        a: "Carbón es un restaurante de carnes y parrilla, con coctelería. Es parte de Manda Group y comparte local con Costa Sushi Reñaca, en Av. Central 184.",
      },
      {
        q: "¿Dónde veo la carta de Carbón?",
        a: "La carta de Carbón se revisa en el local: cada mesa tiene un código QR que la abre en el celular.",
      },
      {
        q: "¿Carbón tiene shows en vivo?",
        a: "Sí. Carbón organiza noches con shows en vivo y cena; las entradas se compran en Vesti y las fechas a la venta aparecen en esta página.",
      },
    ],
    menu: "qr",
    eventsTitle: "Próximos shows en Carbón",
  },
  {
    key: "costa",
    section: "restaurantes",
    slug: "costa-sushi",
    catalogBrand: "costa",
    schemaType: "Restaurant",
    name: "Costa Sushi",
    alternateName: ["Costa Sushi Restobar", "Costa Sushi Reñaca", "Costa Sushi Valparaíso", "Costa Sushi Curauma"],
    cuisine: ["Sushi", "Japonesa"],
    title: "Costa Sushi | Sushi en Reñaca, Valparaíso y Curauma",
    description:
      "Costa Sushi, el sushi bar de Manda Group, con locales en Reñaca, Valparaíso y Curauma. Atención en el local y delivery. Revisa la carta online y cómo llegar.",
    h1: "Costa Sushi, sushi en Reñaca, Valparaíso y Curauma",
    eyebrow: "Sushi bar · Reñaca, Valparaíso y Curauma",
    intro:
      "Costa Sushi es el sushi bar de Manda Group, con tres locales: Reñaca (Av. Central 184, junto a Carbón), Valparaíso y Curauma. Atiende en el local y con delivery, y su carta completa está en el menú online.",
    highlights: [
      { title: "Tres locales", body: "Reñaca, Valparaíso y Curauma, para comer en el local." },
      { title: "Delivery", body: "También puedes pedir tu sushi a domicilio." },
      { title: "Carta online", body: "La carta completa y actualizada, siempre a un clic." },
    ],
    faq: [
      {
        q: "¿Dónde hay un Costa Sushi?",
        a: "Costa Sushi tiene tres locales: en Reñaca (Av. Central 184, el mismo lugar que Carbón), en Valparaíso y en Curauma. En esta página está la dirección de cada uno y el link para llegar.",
      },
      {
        q: "¿Costa Sushi tiene delivery?",
        a: "Sí. Costa Sushi atiende en el local y también con delivery.",
      },
      {
        q: "¿Dónde veo la carta de Costa Sushi?",
        a: "La carta de Costa Sushi está en su menú online, enlazado en esta página y en mandagroup.cl/carta.",
      },
    ],
    menu: "public",
    eventsTitle: "Promociones y fechas",
  },
  {
    key: "renaca",
    section: "clubes",
    slug: "manda-renaca",
    catalogBrand: "manda",
    localIds: ["manda-renaca"],
    schemaType: "NightClub",
    name: "Manda Reñaca",
    alternateName: ["Manda Chile", "Manda Classic Social Lounge"],
    title: "Manda Reñaca | Club y fiestas en Reñaca, entradas y reservas",
    description:
      "Manda Reñaca, el Classic Social Lounge de Manda Group en Av. Borgoño 14.880, Reñaca. Cartelera de fiestas, entradas en Vesti y reserva de mesa por WhatsApp.",
    h1: "Manda Reñaca, club y fiestas en Reñaca",
    eyebrow: "Classic Social Lounge · Reñaca",
    intro:
      "Manda Reñaca es el Classic Social Lounge de Manda Group, en Av. Borgoño 14.880, Reñaca. Las entradas de cada fiesta se compran en Vesti y las mesas se reservan por WhatsApp. Abajo están las próximas fechas a la venta.",
    highlights: [
      { title: "Fiestas", body: "Fechas de fiesta con entradas a la venta en Vesti." },
      { title: "Reserva de mesa", body: "Por el WhatsApp de reservas de Manda Reñaca." },
      { title: "Carta", body: "Tablas, quesadillas, empanaditas y coctelería." },
    ],
    faq: [
      { q: "¿Dónde está Manda Reñaca?", a: "Manda Reñaca está en Av. Borgoño 14.880, Reñaca, comuna de Viña del Mar." },
      {
        q: "¿Cómo compro entradas para Manda Reñaca?",
        a: "Las entradas de cada fiesta se venden en Vesti. En esta página cada fecha tiene su botón \"Comprar entrada\", que lleva directo a la venta.",
      },
      { q: "¿Cuál es el dress code de Manda?", a: DRESS_CODE },
    ],
    menu: "public",
    eventsTitle: "Próximas fiestas en Manda Reñaca",
  },
  {
    key: "vina",
    section: "clubes",
    slug: "manda-vina",
    catalogBrand: "manda",
    localIds: ["manda-vina"],
    schemaType: "NightClub",
    name: "Manda Viña del Mar",
    alternateName: ["Manda Viña", "Manda Viña del Mar"],
    title: "Manda Viña del Mar | Fiestas en Viña, entradas y reservas",
    description:
      "Manda Viña del Mar: fiesta, restaurant y música en 5 Norte 132, Viña del Mar. Cartelera de fiestas, entradas en Vesti y reserva de mesa por Instagram.",
    h1: "Manda Viña del Mar, fiestas en Viña",
    eyebrow: "Fiesta, restaurant y música · Viña del Mar",
    intro:
      "Manda Viña del Mar es el club de Manda Group en 5 Norte 132, Viña del Mar: fiesta, restaurant, música y amigos. Las entradas de cada fiesta se compran en Vesti y las mesas se reservan por mensaje directo en Instagram a @mandavina.cl.",
    highlights: [
      { title: "Fiestas", body: "Fechas de fiesta con entradas a la venta en Vesti." },
      { title: "Reserva de mesa", body: "Por mensaje directo en Instagram a @mandavina.cl." },
      { title: "Restaurant y música", body: "Para comer, tomar algo y quedarse a la fiesta." },
    ],
    faq: [
      { q: "¿Dónde está Manda Viña del Mar?", a: "Manda Viña del Mar está en 5 Norte 132, Viña del Mar." },
      {
        q: "¿Cómo compro entradas para Manda Viña?",
        a: "Las entradas de cada fiesta se venden en Vesti. En esta página cada fecha tiene su botón \"Comprar entrada\", que lleva directo a la venta.",
      },
      { q: "¿Cuál es el dress code de Manda?", a: DRESS_CODE },
    ],
    menu: "public",
    eventsTitle: "Próximas fiestas en Manda Viña",
  },
];

export const brandPagePath = (p: Pick<BrandPage, "section" | "slug">) => `/${p.section}/${p.slug}`;

export const BRAND_PAGE_PATH = Object.fromEntries(BRAND_PAGES.map((p) => [p.key, brandPagePath(p)])) as Record<
  BrandPageKey,
  string
>;

export function findBrandPage(section: string, slug: string): BrandPage | undefined {
  return BRAND_PAGES.find((p) => p.section === section && p.slug === slug);
}

// La de fiestas reúne la cartelera completa (clubes, Costa Nights y shows).
export const FIESTAS_PAGE = {
  path: "/fiestas",
  title: "Fiestas en Viña del Mar y Reñaca | Cartelera Manda Group",
  description:
    "Las próximas fiestas de Manda Reñaca, Manda Viña del Mar y Costa Nights, y los shows de Manda Group, con entradas en Vesti. Fechas, lugares y precios.",
  h1: "Fiestas en Viña del Mar y Reñaca",
  intro:
    "Todas las fiestas y shows de Manda Group a la venta: Manda Reñaca, Manda Viña del Mar, las fiestas Costa Nights en recintos de la región y los shows de Eventos & Stand Up. Cada fecha muestra el lugar, la hora y el precio desde, y se compra en Vesti.",
  faq: [
    {
      q: "¿Dónde compro entradas para las fiestas de Manda Group?",
      a: "Todas las entradas se venden en Vesti. Cada fecha de esta página tiene su botón \"Comprar entrada\", que lleva directo a la venta.",
    },
    {
      q: "¿Qué son las fiestas Costa Nights?",
      a: "Costa Nights es la marca de fiestas de Manda Group: fechas especiales en distintos recintos de la Región de Valparaíso, con entradas en Vesti.",
    },
    { q: "¿Cuál es el dress code?", a: DRESS_CODE },
    {
      q: "¿Cómo reservo una mesa en una fiesta?",
      a: "Manda Reñaca reserva por su WhatsApp de reservas y Manda Viña del Mar por mensaje directo en Instagram a @mandavina.cl. Los links están en la página de cada club.",
    },
  ],
} as const;
