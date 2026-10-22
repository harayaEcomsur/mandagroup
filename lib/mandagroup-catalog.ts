import { db, jsonb, withDb } from "@/lib/db";
import { getReservationNumber } from "@/lib/mandagroup-store";

// Locales (con su canal de reservas) y cartas de las marcas del grupo,
// editables desde /eventos/admin. Se guardan como dos documentos en
// `settings` (son pocos registros y siempre se leen completos), mismo patrón
// que el resto del módulo. Sin nada guardado, valen los DEFAULT_* de abajo —
// que replican lo que existía al migrar desde el hosting anterior.

export type BrandKey = "manda" | "carbon" | "costa";

export const BRAND_LABEL: Record<BrandKey, string> = {
  manda: "Manda",
  carbon: "Carbon",
  costa: "Costa Sushi",
};

export const BRAND_LOGO: Record<BrandKey, string> = {
  manda: "/clients/mandagroup/logo-renaca.webp",
  carbon: "/clients/mandagroup/logo-carbon.webp",
  costa: "/clients/mandagroup/logo-costa-sushi.webp",
};

export function hostOf(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export type Reservation =
  | { type: "whatsapp"; phone: string } // solo dígitos, con código de país (569…)
  | { type: "instagram"; handle: string } // sin @
  | { type: "url"; url: string; label?: string }
  | { type: "none" };

export interface Local {
  id: string;
  brand: BrandKey;
  name: string; // "Manda Reñaca", "Costa Sushi Curauma"
  address?: string;
  mapsUrl?: string;
  hours?: string; // texto tal cual se muestra ("12:00 - 23:00")
  reservation: Reservation;
  showOnSite: boolean;
  order: number;
}

export type CartaSource =
  | {
      type: "file";
      url: string; // /cartas/archivo/x.pdf (del deploy) o URL de Vercel Blob
      sizeBytes?: number;
      // Páginas ya convertidas a WebP (solo las cartas migradas). Si no hay,
      // el sitio dibuja el PDF en el navegador (components/mandagroup/PdfViewer).
      pages?: { src: string; width: number; height: number }[];
      // Las páginas son tramos de una sola imagen larga (cartas diseñadas como
      // un póster vertical): se muestran pegadas, sin espacio entre ellas.
      continuous?: boolean;
    }
  | { type: "url"; url: string };

export interface Carta {
  id: string;
  brand: BrandKey;
  title: string;
  description?: string;
  source: CartaSource;
  // Aparece en /carta (pública e indexable). Las cartas de Carbon van en
  // false: la carta en portugués (turistas) incluye comisiones de agencias y
  // tiene otros precios que la de español, así que ninguna de las dos debe
  // estar a la vista — solo se abren desde su QR o su link directo.
  showOnSite: boolean;
  onCarbonPage: boolean; // aparece en /carbon (QR de mesa de Carbon / Costa Sushi)
  // URLs fijas de QR ya impresos ("/cmanda.pdf"): siempre llevan a la versión
  // vigente de esta carta, sea archivo o link (ver app/[file]/route.ts).
  aliases: string[];
  order: number;
  updatedAt: string;
}

const LOCALES_KEY = "mandagroup_locales";
const CARTAS_KEY = "mandagroup_cartas";
const CARTAS_MIGRATIONS_KEY = "mandagroup_cartas_migrations";

const archived = (f: string) => `/cartas/archivo/${f}`;

export const DEFAULT_LOCALES: Local[] = [
  {
    id: "manda-renaca",
    brand: "manda",
    name: "Manda Reñaca",
    address: "Av. Borgoño 14.880, Reñaca",
    mapsUrl: "https://www.google.com/maps/search/?api=1&query=Manda+Re%C3%B1aca+Av.+Borgo%C3%B1o+14880",
    reservation: { type: "whatsapp", phone: "56990721033" },
    showOnSite: true,
    order: 0,
  },
  {
    id: "manda-vina",
    brand: "manda",
    name: "Manda Viña del Mar",
    address: "5 Norte 132, Viña del Mar",
    mapsUrl: "https://www.google.com/maps/search/?api=1&query=Manda+Vi%C3%B1a+del+Mar+5+Norte+132",
    reservation: { type: "instagram", handle: "mandavina.cl" },
    showOnSite: true,
    order: 1,
  },
  {
    // Mismo local físico que Carbón (Av. Central 184). Direcciones, horario y
    // WhatsApp de los 3 locales: los del sitio de Costa Sushi (tabla locations).
    id: "costa-renaca",
    brand: "costa",
    name: "Costa Sushi Reñaca",
    address: "Av. Central 184, Reñaca",
    mapsUrl: "https://www.google.com/maps/search/?api=1&query=Costa+Sushi+Av.+Central+184+Re%C3%B1aca",
    hours: "12:00 - 23:00",
    reservation: { type: "whatsapp", phone: "56975952454" },
    showOnSite: true,
    order: 2,
  },
  {
    id: "costa-valparaiso",
    brand: "costa",
    name: "Costa Sushi Valparaíso",
    address: "Bernardo O'Higgins 1274, Valparaíso",
    mapsUrl: "https://www.google.com/maps/search/?api=1&query=Costa+Sushi+Bernardo+O%27Higgins+1274+Valpara%C3%ADso",
    hours: "12:00 - 23:00",
    reservation: { type: "whatsapp", phone: "56984999478" },
    showOnSite: true,
    order: 3,
  },
  {
    id: "costa-curauma",
    brand: "costa",
    name: "Costa Sushi Curauma",
    address: "Boulevard 68, Local 20, Placilla, Valparaíso",
    mapsUrl: "https://www.google.com/maps/search/?api=1&query=Costa+Sushi+Curauma+Boulevard+68+Local+20",
    hours: "12:00 - 23:00",
    reservation: { type: "whatsapp", phone: "56958121291" },
    showOnSite: true,
    order: 4,
  },
  {
    id: "carbon",
    brand: "carbon",
    name: "Carbón",
    address: "Av. Central 184, Reñaca",
    mapsUrl: "https://www.google.com/maps/search/?api=1&query=Carb%C3%B3n+Av.+Central+184+Re%C3%B1aca",
    reservation: { type: "none" },
    showOnSite: true,
    order: 5,
  },
];

const T = "2026-10-06T00:00:00.000Z";

// Carta de Manda Reñaca (oct. 2026): el PDF original pesaba 64 MB (Illustrator,
// una sola página de 1920×12187 pt). Se publica en 5 tramos WebP de 1600 px
// (~1 MB en total) y un PDF liviano para descargar.
const MANDA_RENACA: Carta = {
  id: "manda-renaca",
  brand: "manda",
  title: "Carta Manda Reñaca",
  description: "Raw bar, hamburguesas, pizzas, tablas para compartir y coctelería.",
  source: {
    type: "file",
    url: archived("manda-renaca.pdf"),
    sizeBytes: 1547692,
    pages: [2032, 2032, 2032, 2032, 2028].map((height, i) => ({ src: `/cartas/manda-renaca-${i + 1}.webp`, width: 1600, height })),
    continuous: true,
  },
  showOnSite: true,
  onCarbonPage: false,
  aliases: [],
  order: -1,
  updatedAt: "2026-10-22T00:00:00.000Z",
};

export const DEFAULT_CARTAS: Carta[] = [
  MANDA_RENACA,
  {
    id: "manda",
    brand: "manda",
    title: "Carta Manda Viña del Mar",
    description: "Tablas, quesadillas, empanaditas y coctelería.",
    source: {
      type: "file",
      url: archived("cmanda.pdf"),
      pages: [{ src: "/cartas/manda.webp", width: 1200, height: 6882 }],
    },
    showOnSite: true,
    onCarbonPage: false,
    aliases: ["/cmanda.pdf"],
    order: 0,
    updatedAt: T,
  },
  {
    id: "carbon",
    brand: "carbon",
    title: "Carta Carbon",
    description: "Carnes y parrilla.",
    source: {
      type: "file",
      url: archived("carta2026.pdf"),
      pages: [1, 2, 3, 4, 5].map((n) => ({ src: `/cartas/carbon-${n}.webp`, width: 1200, height: 1552 })),
    },
    showOnSite: false,
    onCarbonPage: true,
    aliases: ["/carta2026.pdf"],
    order: 1,
    updatedAt: T,
  },
  {
    id: "carbon-pt",
    brand: "carbon",
    title: "Cardápio Carbon (português)",
    description: "Carta de Carbon para turistas, em português.",
    source: { type: "file", url: archived("portugues2.pdf") },
    showOnSite: false,
    onCarbonPage: false,
    aliases: ["/portugues2.pdf", "/portugues1.pdf"],
    order: 2,
    updatedAt: T,
  },
  {
    id: "carbon-es-turistas",
    brand: "carbon",
    title: "Carta Carbon (turistas, español)",
    source: { type: "file", url: archived("espanol1.pdf") },
    showOnSite: false,
    onCarbonPage: false,
    aliases: ["/espanol1.pdf"],
    order: 3,
    updatedAt: T,
  },
  // Cartas que solo existen para QR ya impresos (estado inicial, igual que en
  // el hosting anterior): siguen mostrando su archivo (no aparecen en /carta)
  // hasta que se cambien, se reasignen o se borren en el panel.
  {
    id: "manda-bar-anterior",
    brand: "manda",
    title: "Carta bar Manda (QR cartabarmanda.pdf)",
    source: { type: "file", url: archived("cartabarmanda.pdf") },
    showOnSite: false,
    onCarbonPage: false,
    aliases: ["/cartabarmanda.pdf"],
    order: 4,
    updatedAt: T,
  },
  {
    id: "carbon-carta-anterior",
    brand: "carbon",
    title: "Carta Carbon anterior (QR carta.pdf)",
    source: { type: "file", url: archived("carta.pdf") },
    showOnSite: false,
    onCarbonPage: false,
    aliases: ["/carta.pdf"],
    order: 5,
    updatedAt: T,
  },
  {
    id: "carbon-bar-anterior",
    brand: "carbon",
    title: "Carta Carbon anterior (QR bar.pdf)",
    source: { type: "file", url: archived("bar.pdf") },
    showOnSite: false,
    onCarbonPage: false,
    aliases: ["/bar.pdf"],
    order: 6,
    updatedAt: T,
  },
  {
    id: "costa",
    brand: "costa",
    title: "Carta Costa Sushi",
    description: "Sushi bar y delivery. Menú online del restaurante.",
    source: { type: "url", url: "https://menu.fu.do/costarestobar/qr-menu" },
    showOnSite: true,
    onCarbonPage: true,
    aliases: [],
    order: 7,
    updatedAt: T,
  },
  {
    id: "costa-curauma",
    brand: "costa",
    title: "Carta Costa Sushi Curauma",
    source: { type: "file", url: archived("curauma.pdf") },
    showOnSite: true,
    onCarbonPage: false,
    aliases: ["/curauma.pdf"],
    order: 8,
    updatedAt: T,
  },
];

// Memoria (dev sin DATABASE_URL): mismo patrón que lib/mandagroup-store.ts.
const g = globalThis as unknown as {
  __mandagroupCatalog?: { locales: Local[] | null; cartas: Carta[] | null; migrations: string[] | null };
};
function mem() {
  if (!g.__mandagroupCatalog) g.__mandagroupCatalog = { locales: null, cartas: null, migrations: null };
  return g.__mandagroupCatalog;
}

async function readDoc<T>(key: string, memKey: "locales" | "cartas" | "migrations"): Promise<T | null> {
  return withDb(
    async () => {
      const sql = db();
      const rows = await sql`SELECT value FROM settings WHERE key = ${key} LIMIT 1`;
      return (rows[0]?.value as T | undefined) ?? null;
    },
    () => mem()[memKey] as T | null
  );
}

async function writeDoc(key: string, memKey: "locales" | "cartas" | "migrations", value: Local[] | Carta[] | string[]): Promise<void> {
  await withDb(
    async () => {
      const sql = db();
      await sql`
        INSERT INTO settings (key, value) VALUES (${key}, ${jsonb(value)})
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
      `;
    },
    () => {
      (mem() as Record<string, unknown>)[memKey] = value;
    }
  );
}

const byOrder = <T extends { order: number }>(list: T[]) => [...list].sort((a, b) => a.order - b.order);

export async function listLocales(): Promise<Local[]> {
  const saved = await readDoc<Local[]>(LOCALES_KEY, "locales");
  if (saved) return byOrder(saved);
  // Primera vez: si en el panel ya había un WhatsApp de reservas (el campo
  // anterior, solo de Reñaca), se respeta en el local de Reñaca.
  const legacyPhone = await getReservationNumber();
  return DEFAULT_LOCALES.map((l) =>
    l.id === "manda-renaca" && legacyPhone ? { ...l, reservation: { type: "whatsapp", phone: legacyPhone } } : l
  );
}

export async function saveLocales(locales: Local[]): Promise<void> {
  await writeDoc(LOCALES_KEY, "locales", locales);
}

// Cambios de catálogo que deben llegar también a las cartas ya guardadas desde
// el panel (allí no aplican los DEFAULT_CARTAS). Cada uno corre una sola vez:
// si después se edita o se borra en el panel, no vuelve.
const CARTA_MIGRATIONS: { id: string; apply: (list: Carta[]) => Carta[] }[] = [
  {
    id: "2026-10-manda-renaca",
    apply: (list) =>
      (list.some((c) => c.id === MANDA_RENACA.id) ? list : [MANDA_RENACA, ...list]).map((c) =>
        c.id === "manda" && c.title === "Carta Manda" ? { ...c, title: "Carta Manda Viña del Mar" } : c
      ),
  },
];

export async function listCartas(): Promise<Carta[]> {
  const saved = await readDoc<Carta[]>(CARTAS_KEY, "cartas");
  if (!saved) return byOrder(DEFAULT_CARTAS);
  const applied = (await readDoc<string[]>(CARTAS_MIGRATIONS_KEY, "migrations")) ?? [];
  const pending = CARTA_MIGRATIONS.filter((m) => !applied.includes(m.id));
  if (pending.length === 0) return byOrder(saved);
  const migrated = pending.reduce((list, m) => m.apply(list), saved);
  await writeDoc(CARTAS_KEY, "cartas", migrated);
  await writeDoc(CARTAS_MIGRATIONS_KEY, "migrations", [...applied, ...pending.map((m) => m.id)]);
  return byOrder(migrated);
}

export async function saveCartas(cartas: Carta[]): Promise<void> {
  await writeDoc(CARTAS_KEY, "cartas", cartas);
}

// "/CMANDA.PDF/" → "/cmanda.pdf" — los alias se comparan normalizados.
export function normalizeAlias(path: string): string {
  const p = ("/" + path.trim().replace(/^https?:\/\/[^/]+/i, "").replace(/^\/+/, "")).replace(/\/+$/, "");
  return p.toLowerCase();
}

export async function findCartaByAlias(path: string): Promise<Carta | null> {
  const target = normalizeAlias(path);
  return (await listCartas()).find((c) => c.aliases.some((a) => normalizeAlias(a) === target)) ?? null;
}

// Link listo para reservar en un local (o null si no reserva online).
export function reservationLink(l: Local): { href: string; via: string } | null {
  const r = l.reservation;
  if (r.type === "whatsapp" && r.phone) {
    const text = encodeURIComponent(`Hola! Quiero reservar en ${l.name}`);
    // Costa Sushi usa su WhatsApp para pedidos y reservas.
    const via = l.brand === "costa" ? "Por WhatsApp, pedidos y reservas" : "Por WhatsApp de reservas";
    return { href: `https://wa.me/${r.phone.replace(/\D/g, "")}?text=${text}`, via };
  }
  if (r.type === "instagram" && r.handle) {
    const h = r.handle.replace(/^@/, "");
    return { href: `https://ig.me/m/${h}`, via: `Por Instagram, @${h}` };
  }
  if (r.type === "url" && r.url) {
    let host = r.url;
    try {
      host = new URL(r.url).host;
    } catch {}
    return { href: r.url, via: r.label || `En ${host}` };
  }
  return null;
}
