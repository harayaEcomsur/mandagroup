// Marcas de Manda Group: fuente única para la home (bento + feed de
// Instagram), el JSON-LD y /llms.txt — así el nombre, la dirección y la
// cuenta de cada marca no se desalinean entre lo que ve la gente y lo que
// leen Google y los asistentes de IA.
// Las 4 marcas del holding. Cada una con su cuenta de Instagram: el feed se
// lee con el token propio de la cuenta (env por marca — los de Reñaca y Viña
// son los mismos que ya usa el asistente de DMs). Sin token, la marca igual
// aparece con su foto/logo y un link al perfil.
export const BRANDS = [
  {
    key: "renaca",
    name: "Manda Reñaca",
    kind: "Classic Social Lounge",
    address: "Av. Borgoño 14.880, Reñaca",
    maps: "https://www.google.com/maps/search/?api=1&query=Manda+Re%C3%B1aca+Av.+Borgo%C3%B1o+14880",
    logo: "/clients/mandagroup/logo-renaca.png",
    handle: "manda.chile",
    tokenEnv: "INSTAGRAM_TOKEN_MANDACHILE",
    fallbackImage: "/clients/mandagroup/hero-cocktails.jpg",
  },
  {
    key: "vina",
    name: "Manda Viña del Mar",
    kind: "Fiesta, restaurant y música",
    address: "5 Norte 132, Viña del Mar",
    maps: "https://www.google.com/maps/search/?api=1&query=Manda+Vi%C3%B1a+del+Mar+5+Norte+132",
    logo: "/clients/mandagroup/logo-vina.png",
    handle: "mandavina.cl",
    tokenEnv: "INSTAGRAM_TOKEN_MANDAVINA",
    fallbackImage: null,
  },
  {
    key: "costa",
    name: "Costa Sushi",
    kind: "Sushi bar y delivery en Valparaíso y Curauma",
    address: null,
    maps: null,
    logo: "/clients/mandagroup/logo-costa-sushi.png",
    handle: "costasushicl_",
    tokenEnv: "INSTAGRAM_TOKEN_COSTASUSHI",
    fallbackImage: "/clients/mandagroup/costa-sushi.jpg",
  },
  {
    key: "carbon",
    name: "Carbon",
    kind: "Carnes y parrilla",
    address: null,
    maps: null,
    logo: "/clients/mandagroup/logo-carbon.png",
    handle: "carbon.chile",
    tokenEnv: "INSTAGRAM_TOKEN_CARBON",
    fallbackImage: null,
  },
] as const;

export type Brand = (typeof BRANDS)[number];

// Comuna para el schema (PostalAddress.addressLocality) de los 2 clubes.
export const VENUE_LOCALITY: Record<"renaca" | "vina", string> = {
  renaca: "Reñaca, Viña del Mar",
  vina: "Viña del Mar",
};

export const SITE_FAQ = [
  {
    q: "¿Cómo compro entradas para las fiestas de Manda?",
    a: "Todas las entradas se venden en Vesti. En la cartelera de esta página cada fecha tiene su botón \"Comprar entrada\", que lleva directo a la venta. También puedes escribir \"ENTRADAS\" por DM a @mandavina.cl o @manda.chile y te enviamos el link.",
  },
  {
    q: "¿Cómo reservo una mesa en Manda Reñaca o Manda Viña del Mar?",
    a: "Las reservas de mesa y listas se coordinan por WhatsApp. Escríbenos indicando el local y la fecha, y te confirmamos disponibilidad.",
  },
  {
    q: "¿Dónde están Manda Reñaca y Manda Viña del Mar?",
    a: "Manda Reñaca está en Av. Borgoño 14.880, Reñaca. Manda Viña del Mar está en 5 Norte 132, Viña del Mar.",
  },
  {
    q: "¿Dónde está Costa Sushi?",
    a: "Costa Sushi tiene locales en Valparaíso y en Curauma, con atención en el local y delivery.",
  },
  {
    q: "¿Cuál es el dress code?",
    a: "No se permite pantalón cargo o jogger, lentes de sol, short, bananos, ropa deportiva ni buzos, cadenas a la vista, poleras sin mangas ni sandalias. Quien no lo cumpla puede tener que retirarse de la fiesta.",
  },
  {
    q: "¿Qué marcas forman parte de Manda Group?",
    a: "Manda Group reúne los clubes Manda Reñaca y Manda Viña del Mar, las fiestas Costa Nights, el restaurante Costa Sushi (con locales en Valparaíso y Curauma) y Carbon.",
  },
] as const;
