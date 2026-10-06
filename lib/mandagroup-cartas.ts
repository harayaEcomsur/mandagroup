// Cartas de los restaurantes, rescatadas del hosting anterior de
// mandagroup.cl (cPanel) y servidas desde /public en las MISMAS URLs de antes
// (/cmanda.pdf, /carta2026.pdf): hay QR impresos en las mesas que apuntan ahí
// y a /carbon. /carta.pdf (carta anterior de Carbon, 4 págs.) también se
// sirve tal cual por si algún QR viejo apunta a ella, aunque no se lista acá. Cada página del PDF va además como WebP para verla directo en
// el celular — el PDF de Manda pesa 28 MB, la versión web 0,6 MB.
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
  { name: "Costa Sushi", logo: "/clients/mandagroup/logo-costa-sushi.webp", href: "https://menu.fu.do/costarestobar/qr-menu" },
] as const;
