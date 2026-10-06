import type { EventVenue, MandagroupEvent } from "@/lib/mandagroup-store";

// Qué se destaca en la home. Funciones puras sobre la lista que ya devuelve
// listActiveEvents — sin datos nuevos, solo reglas de presentación.

// Promoción = dura varios días (ej. Cyber Days Costa Sushi, del 6 al 31). No
// es "una noche de fiesta": va en su propia sección, no en la cartelera ni en
// el hero (salvo que se destaque a mano).
export function isPromo(e: MandagroupEvent): boolean {
  return Boolean(e.lastDate && e.lastDate !== e.eventDate);
}

export function splitEvents(events: MandagroupEvent[]) {
  return {
    nights: events.filter((e) => !isPromo(e)),
    promos: events.filter(isPromo),
  };
}

// Prioridad dentro de una misma noche: primero lo que se vende en los locales
// del grupo, después las marcas de eventos.
const VENUE_PRIORITY: Record<EventVenue, number> = { vina: 0, renaca: 1, costa: 2, standup: 3 };

function byPriority(a: MandagroupEvent, b: MandagroupEvent): number {
  return (
    VENUE_PRIORITY[a.venue] - VENUE_PRIORITY[b.venue] || (a.startsAt ?? a.eventDate).localeCompare(b.startsAt ?? b.eventDate)
  );
}

export interface HeroPick {
  events: MandagroupEvent[]; // 1 o 2, con flyer, en orden de prioridad
  extra: number; // cuántos más hay esa misma noche (van a la cartelera)
  featured: boolean; // true = elegidos a mano con "Destacar" en el panel
}

const MAX_IN_HERO = 2;

// 1. Si hay eventos destacados a mano (con flyer), mandan ellos — incluidas
//    promociones —, los más próximos primero.
// 2. Si no, la próxima noche con fiestas: todos los eventos de esa fecha, en
//    orden de prioridad (Manda Viña, Manda Reñaca, Costa Nights, Stand Up).
export function pickHero(events: MandagroupEvent[]): HeroPick | null {
  const withFlyer = events.filter((e) => e.imageUrl);

  const featured = withFlyer.filter((e) => e.featured);
  if (featured.length) {
    const sorted = [...featured].sort((a, b) => a.eventDate.localeCompare(b.eventDate) || byPriority(a, b));
    return { events: sorted.slice(0, MAX_IN_HERO), extra: 0, featured: true };
  }

  const nights = withFlyer.filter((e) => !isPromo(e));
  if (!nights.length) return null;
  const nextDate = nights.reduce((min, e) => (e.eventDate < min ? e.eventDate : min), nights[0].eventDate);
  const sameNight = nights.filter((e) => e.eventDate === nextDate).sort(byPriority);
  return {
    events: sameNight.slice(0, MAX_IN_HERO),
    extra: Math.max(0, sameNight.length - MAX_IN_HERO),
    featured: false,
  };
}
