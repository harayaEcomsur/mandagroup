// Cartas de los restaurantes, rescatadas del hosting anterior de
// mandagroup.cl (cPanel) y servidas desde /public en las MISMAS URLs de antes
// (/cmanda.pdf, /carta2026.pdf): hay QR impresos en las mesas que apuntan ahí
// y a /carbon. /carta.pdf (carta anterior de Carbon, 4 págs.) también se
// sirve tal cual por si algún QR viejo apunta a ella, aunque no se lista acá.
// Cada página del PDF va además como WebP para verla directo en el celular —
// el PDF de Manda pesa 28 MB, la versión web 0,6 MB.
export interface Carta {
  key: "manda" | "carbon";
  name: string;
  description: string;
  logos: { src: string; alt: string; light?: boolean }[]; // light: logo oscuro, va sobre fondo claro
  pdf: string;
  pages: { src: string; width: number; height: number }[];
}

export const CARTAS: Carta[] = [
  {
    key: "manda",
    name: "Carta Manda",
    description: "Tablas, quesadillas, empanaditas y coctelería de Manda.",
    logos: [{ src: "/clients/mandagroup/logo-renaca.webp", alt: "Manda" }],
    pdf: "/cmanda.pdf",
    pages: [{ src: "/cartas/manda.webp", width: 1200, height: 6882 }],
  },
  {
    key: "carbon",
    name: "Carta Carbon",
    description: "Carnes y parrilla de Carbon.",
    logos: [{ src: "/clients/mandagroup/logo-carbon.webp", alt: "Carbon" }],
    pdf: "/carta2026.pdf",
    pages: [1, 2, 3, 4, 5].map((n) => ({ src: `/cartas/carbon-${n}.webp`, width: 1200, height: 1552 })),
  },
];

// Las dos opciones de la página /carbon, tal como estaban en el sitio
// anterior (destinos de los QR de mesa): Carbon → su PDF, Costa Sushi → su
// menú en Fudo (externo, lo administra el restaurante).
export const QR_MENU_LINKS = [
  { name: "Carbon", logo: "/clients/mandagroup/logo-carbon.webp", href: "/carta2026.pdf" },
  {
    name: "Costa Sushi",
    logo: "/clients/mandagroup/logo-costa-sushi.webp",
    href: "https://menu.fu.do/costarestobar/qr-menu",
    external: "menu.fu.do",
  },
] as const;

// Selector de /carta: las 3 cartas al mismo nivel, cada una diciendo CÓMO se
// abre — Manda y Carbon se leen en la misma página (con su PDF opcional);
// Costa Sushi es un menú externo en Fudo (no hay archivo que mostrar acá).
export type CartaOption =
  | {
      kind: "inline";
      key: "manda" | "carbon";
      name: string;
      blurb: string;
      logo: string;
      pdf: { href: string; size: string };
      extra?: { label: string; href: string }[];
    }
  | { kind: "external"; key: "costa"; name: string; blurb: string; logo: string; href: string; host: string };

export const CARTA_OPTIONS: CartaOption[] = [
  {
    kind: "inline",
    key: "manda",
    name: "Manda",
    blurb: "Tablas, quesadillas, empanaditas y coctelería.",
    logo: "/clients/mandagroup/logo-renaca.webp",
    pdf: { href: "/cmanda.pdf", size: "27 MB" },
  },
  {
    kind: "inline",
    key: "carbon",
    name: "Carbon",
    blurb: "Carnes y parrilla.",
    logo: "/clients/mandagroup/logo-carbon.webp",
    pdf: { href: "/carta2026.pdf", size: "2,7 MB" },
    extra: [{ label: "Em português", href: "/portugues2.pdf" }],
  },
  {
    kind: "external",
    key: "costa",
    name: "Costa Sushi",
    blurb: "Sushi bar y delivery. Su carta está en Fudo, el menú online del restaurante.",
    logo: "/clients/mandagroup/logo-costa-sushi.webp",
    href: "https://menu.fu.do/costarestobar/qr-menu",
    host: "menu.fu.do",
  },
];
