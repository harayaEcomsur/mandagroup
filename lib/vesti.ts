import { get } from "node:https";
import { unstable_cache } from "next/cache";
import type { Venue } from "@/lib/mandagroup-store";

// Eventos de Vesti (la boletería de Manda): toda la venta de entradas pasa
// por ahí, así que la cartelera "real" vive en la página pública de cada
// local en vesti.cl. Vesti no tiene API pública, pero esa página es Next.js
// y trae embebido el listado de próximos eventos (nombre, fecha, flyer, slug,
// precio desde) en el payload RSC — se lee de ahí, cacheado 15 min, para que
// un evento nuevo cargado en Vesti aparezca solo en el sitio y en el
// asistente sin que nadie lo tenga que volver a cargar en /eventos/admin.
//
// Si Vesti cambia su markup esto devuelve [] (nunca rompe la página): el
// sitio sigue mostrando los eventos cargados a mano.

const VESTI_COMPANIES: Record<Venue, string> = {
  renaca: "manda-renaca",
  vina: "manda-group-vina",
};

export interface VestiEvent {
  vestiId: string;
  venue: Venue;
  name: string;
  startsAt: string; // ISO UTC, tal cual lo entrega Vesti
  eventDate: string; // "YYYY-MM-DD" en hora de Chile (la noche del evento)
  imageUrl: string | null;
  url: string;
  lowestPrice: number | null; // CLP; null/0 = gratis o sin precio publicado
}

interface RawVestiEvent {
  id?: string;
  name?: string;
  dateIni?: string;
  images?: string[];
  slug?: string;
  lowestPrice?: number;
  isClosed?: boolean;
}

function chileDate(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago" }).format(new Date(iso));
}

// El payload viene como string JS escapado dentro de <script>self.__next_f…>;
// se des-escapan las comillas y se busca el arreglo "events" (los próximos —
// "pastEvents" es otro arreglo aparte que se ignora a propósito).
function extractEvents(html: string): RawVestiEvent[] {
  const text = html.replace(/\\"/g, '"');
  const start = text.indexOf('"events":[{"__typename":"Event"');
  if (start === -1) return [];
  const arrayStart = text.indexOf("[", start);
  let depth = 0;
  for (let i = arrayStart; i < text.length; i++) {
    const ch = text[i];
    if (ch === "[" || ch === "{") depth++;
    else if (ch === "]" || ch === "}") depth--;
    if (depth === 0) {
      try {
        return JSON.parse(text.slice(arrayStart, i + 1)) as RawVestiEvent[];
      } catch {
        return [];
      }
    }
  }
  return [];
}

// Lectura directa con node:https y no con fetch: la página pesa ~3 MB (sobre
// el límite de 2 MB del data cache de Next) y un fetch "no-store" marca la
// página como dinámica en pleno build — Next lo lanza como error, el catch
// lo tragaba y la home quedaba prerenderizada SIN cartelera. Lo que se cachea
// es el listado ya parseado (unstable_cache en listVestiEvents).
function fetchText(url: string, redirects = 3): Promise<string | null> {
  return new Promise((resolve) => {
    const req = get(url, { headers: { "User-Agent": "Mozilla/5.0 (compatible; MandaGroupSite/1.0)" }, timeout: 10_000 }, (res) => {
      // Vesti redirige www.vesti.cl → vesti.cl (308); node:https no sigue
      // redirecciones solo.
      const location = res.headers.location;
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && location && redirects > 0) {
        res.resume();
        resolve(fetchText(new URL(location, url).toString(), redirects - 1));
        return;
      }
      if (res.statusCode !== 200) {
        res.resume();
        resolve(null);
        return;
      }
      const chunks: Buffer[] = [];
      res.on("data", (c: Buffer) => chunks.push(c));
      res.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
      res.on("error", () => resolve(null));
    });
    req.on("timeout", () => req.destroy());
    req.on("error", () => resolve(null));
  });
}

async function fetchVenueEvents(venue: Venue): Promise<VestiEvent[] | null> {
  const company = VESTI_COMPANIES[venue];
  try {
    const html = await fetchText(`https://vesti.cl/company/${company}`);
    if (!html) return null;
    const raw = extractEvents(html);
    return raw
      .filter((e) => e.id && e.name && e.dateIni && e.slug && !e.isClosed)
      .map((e) => ({
        vestiId: e.id!,
        venue,
        name: e.name!
          .replace(/\*+/g, " ")
          .replace(/\s*\/\/\s*/g, " / ")
          .replace(/[\s/]+$/, "")
          .replace(/\s{2,}/g, " ")
          .trim(),
        startsAt: e.dateIni!,
        eventDate: chileDate(e.dateIni!),
        imageUrl: e.images?.[0] ?? null,
        url: `https://www.vesti.cl/events/${e.slug}`,
        lowestPrice: e.lowestPrice ? e.lowestPrice : null,
      }));
  } catch (error) {
    console.error(`[vesti] ${company}:`, error);
    return null;
  }
}

// Próximos eventos de ambos locales, ordenados por fecha. Si Vesti no
// responde, la función cacheada lanza (así un fallo momentáneo NO queda
// guardado 15 min como "no hay eventos") y el wrapper devuelve [].
const cachedVestiEvents = unstable_cache(
  async (): Promise<VestiEvent[]> => {
    const all = await Promise.all((Object.keys(VESTI_COMPANIES) as Venue[]).map(fetchVenueEvents));
    if (all.some((list) => list === null)) throw new Error("Vesti no respondió");
    return (all as VestiEvent[][]).flat().sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  },
  ["vesti-events-v2"],
  { revalidate: 900 }
);

export async function listVestiEvents(): Promise<VestiEvent[]> {
  try {
    return await cachedVestiEvents();
  } catch (error) {
    console.error("[vesti]", error);
    return [];
  }
}

export function vestiCompanyUrl(venue: Venue): string {
  return `https://www.vesti.cl/company/${VESTI_COMPANIES[venue]}`;
}
