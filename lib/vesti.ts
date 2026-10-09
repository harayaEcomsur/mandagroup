import { request } from "node:https";
import { unstable_cache } from "next/cache";
import type { EventVenue } from "@/lib/mandagroup-store";

// Eventos de Vesti (la boletería de Manda): toda la venta de entradas pasa
// por ahí, así que la cartelera "real" vive en Vesti. Se lee de la misma API
// GraphQL pública que usa vesti.cl en el navegador (api.vesti.cl/graphql):
// - vendorPublicProfile: los próximos eventos de cada cuenta
// - event: el detalle de cada uno — dirección real con coordenadas, recinto,
//   hora de término, tipos de entrada con precio y si están agotados,
//   cancelado/reprogramado
// Cacheado 15 min, para que un evento nuevo cargado en Vesti aparezca solo en
// el sitio y en el asistente sin que nadie lo vuelva a cargar en el panel.
//
// No es una API documentada: si Vesti la cambia, esto devuelve [] (nunca
// rompe la página) y el sitio sigue mostrando los eventos cargados a mano.

// Las cuentas del grupo en Vesti: los 2 locales, Costa Eventos (fiestas Costa
// Nights en recintos externos) y Eventos & Stand Up (humor y promociones).
const VESTI_COMPANIES: Record<EventVenue, string> = {
  renaca: "manda-renaca",
  vina: "manda-group-vina",
  costa: "costa-eventos",
  standup: "eventos-y-stand-up",
};

export interface VestiTicket {
  name: string;
  price: number; // CLP; 0 = cortesía
  soldOut: boolean;
}

export interface VestiEvent {
  vestiId: string;
  venue: EventVenue;
  name: string;
  startsAt: string; // ISO UTC, tal cual lo entrega Vesti
  endsAt: string | null;
  eventDate: string; // "YYYY-MM-DD" en hora de Chile (la noche del evento)
  lastDate: string; // "YYYY-MM-DD" en hora de Chile del día en que termina (= eventDate si dura una noche)
  imageUrl: string | null;
  url: string;
  // Precio más bajo de una entrada pagada y disponible (las cortesías de $0
  // no cuentan: "desde $0" no dice nada). null = sin precio pagado publicado.
  lowestPrice: number | null;
  tickets: VestiTicket[];
  soldOut: boolean; // todas las entradas agotadas
  rescheduled: boolean;
  place: string | null; // recinto ("Club Naval"); null si es el propio local
  address: string | null; // dirección completa, salvo que el evento la oculte
  comuna: string | null;
  geo: { lat: number; lng: number } | null;
}

interface RawProfileEvent {
  id: string;
  name: string;
  dateIni: string;
  images?: string[];
  slug: string;
  isClosed?: boolean;
}

interface RawEventDetail {
  place: string | null;
  comuna: string | null;
  address: { address: string | null; lat: number | null; lng: number | null } | null;
  hideAddress: boolean | null;
  dateEnd: string | null;
  isCanceled: boolean | null;
  isRescheduled: boolean | null;
  tickets: { name: string; price: number; isSoldOut: boolean }[] | null;
}

const PROFILE_QUERY = `query($i: GetVendorPublicProfileInput!) {
  vendorPublicProfile(getVendorPublicProfileInput: $i) {
    events { id name dateIni images slug isClosed }
  }
}`;

const EVENT_QUERY = `query($i: GetEventInput!) {
  event(getEventInput: $i) {
    place comuna hideAddress dateEnd isCanceled isRescheduled
    address { address lat lng }
    tickets { name price isSoldOut }
  }
}`;

// POST con node:https y no con fetch: un fetch sin caché dentro de la home
// la marca como dinámica en pleno build (Next lo lanza como error y la home
// quedaba prerenderizada sin cartelera). Lo que se cachea es el listado ya
// armado (unstable_cache en listVestiEvents).
function gql<T>(query: string, variables: Record<string, unknown>): Promise<T | null> {
  const body = JSON.stringify({ query, variables });
  return new Promise((resolve) => {
    const req = request(
      "https://api.vesti.cl/graphql",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
          "User-Agent": "Mozilla/5.0 (compatible; MandaGroupSite/1.0)",
        },
        timeout: 10_000,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => chunks.push(c));
        res.on("end", () => {
          try {
            const json = JSON.parse(Buffer.concat(chunks).toString("utf8")) as { data?: T; errors?: unknown };
            resolve(res.statusCode === 200 && json.data && !json.errors ? json.data : null);
          } catch {
            resolve(null);
          }
        });
        res.on("error", () => resolve(null));
      }
    );
    req.on("timeout", () => req.destroy());
    req.on("error", () => resolve(null));
    req.end(body);
  });
}

// Respaldo cuando Vesti no trae el recinto como dato (pasa seguido en Costa
// Eventos): viene como último tramo del nombre ("HALLOWEEN … / 31.10 / CLUB
// NAVAL"). Se toma ese tramo si no es una fecha.
// Locales del grupo que Vesti no nombra como recinto (place viene null y el
// sitio mostraría solo la comuna): se reconocen por la dirección. Ej. el show
// de Luis Jara en Carbón, vendido por la cuenta Eventos & Stand Up.
const OWN_PLACES: { address: RegExp; place: string }[] = [{ address: /\bcentral\s+184\b/i, place: "Carbón, Reñaca" }];

function placeFromAddress(address: string | null | undefined): string | null {
  return (address && OWN_PLACES.find((p) => p.address.test(address))?.place) || null;
}

function placeFromName(name: string): string | null {
  const parts = name.split(" / ").map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) return null;
  const last = parts[parts.length - 1];
  if (/^\d{1,2}[./]\d{1,2}$/.test(last)) return null;
  return titleCase(last);
}

// "CLUB NAVAL" → "Club Naval" (los nombres vienen en mayúsculas sostenidas)
function titleCase(s: string): string {
  return s === s.toUpperCase() ? s.toLowerCase().replace(/(^|\s)\p{L}/gu, (c) => c.toUpperCase()) : s;
}

function cleanName(name: string): string {
  return name
    .replace(/\*+/g, " ")
    .replace(/\s*\/\/\s*/g, " / ")
    .replace(/[\s/]+$/, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function chileDate(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago" }).format(new Date(iso));
}

async function fetchVenueEvents(venue: EventVenue): Promise<VestiEvent[] | null> {
  const profile = await gql<{ vendorPublicProfile: { events: RawProfileEvent[] } | null }>(PROFILE_QUERY, {
    i: { slug: VESTI_COMPANIES[venue] },
  });
  if (!profile?.vendorPublicProfile) return null;

  const upcoming = profile.vendorPublicProfile.events.filter((e) => e.id && e.name && e.dateIni && e.slug && !e.isClosed);
  const details = await Promise.all(
    upcoming.map((e) => gql<{ event: RawEventDetail | null }>(EVENT_QUERY, { i: { slug: e.slug } }))
  );

  return upcoming.flatMap((e, idx) => {
    const d = details[idx]?.event ?? null;
    if (d?.isCanceled) return [];
    const name = cleanName(e.name);
    const tickets = (d?.tickets ?? []).map((t) => ({ name: t.name, price: t.price, soldOut: t.isSoldOut }));
    const paid = tickets.filter((t) => t.price > 0 && !t.soldOut).map((t) => t.price);
    const showAddress = d && !d.hideAddress && d.address?.address;
    return [
      {
        vestiId: e.id,
        venue,
        name,
        startsAt: e.dateIni,
        endsAt: d?.dateEnd ?? null,
        eventDate: chileDate(e.dateIni),
        // Una fiesta termina de madrugada del día siguiente: eso sigue siendo
        // "la noche del evento". Solo cuenta como varios días si termina más
        // de 18 h después de empezar (ej. una promoción de una semana).
        lastDate:
          d?.dateEnd && Date.parse(d.dateEnd) - Date.parse(e.dateIni) > 18 * 3600 * 1000
            ? chileDate(d.dateEnd)
            : chileDate(e.dateIni),
        imageUrl: e.images?.[0] ?? null,
        url: `https://www.vesti.cl/events/${e.slug}`,
        lowestPrice: paid.length ? Math.min(...paid) : null,
        tickets,
        soldOut: tickets.length > 0 && tickets.every((t) => t.soldOut),
        rescheduled: Boolean(d?.isRescheduled),
        place: d?.place
          ? titleCase(d.place)
          : placeFromAddress(d?.address?.address) ?? (venue === "costa" ? placeFromName(name) : null),
        address: showAddress ? d.address!.address : null,
        comuna: d?.comuna ?? null,
        geo:
          showAddress && d.address!.lat != null && d.address!.lng != null
            ? { lat: d.address!.lat, lng: d.address!.lng }
            : null,
      },
    ];
  });
}

// Próximos eventos de las 3 cuentas, ordenados por fecha. Si Vesti no
// responde, la función cacheada lanza (así un fallo momentáneo NO queda
// guardado 15 min como "no hay eventos") y el wrapper devuelve [].
export const VESTI_CACHE_TAG = "vesti-events";

const cachedVestiEvents = unstable_cache(
  async (): Promise<VestiEvent[]> => {
    const all = await Promise.all((Object.keys(VESTI_COMPANIES) as EventVenue[]).map(fetchVenueEvents));
    if (all.some((list) => list === null)) throw new Error("Vesti no respondió");
    return (all as VestiEvent[][]).flat().sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  },
  ["vesti-events-v6"],
  { revalidate: 900, tags: [VESTI_CACHE_TAG] }
);

export async function listVestiEvents(): Promise<VestiEvent[]> {
  try {
    return await cachedVestiEvents();
  } catch (error) {
    console.error("[vesti]", error);
    return [];
  }
}

export function vestiCompanyUrl(venue: EventVenue): string {
  return `https://www.vesti.cl/company/${VESTI_COMPANIES[venue]}`;
}
