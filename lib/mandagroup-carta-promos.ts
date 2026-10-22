import type { MandagroupEvent } from "@/lib/mandagroup-store";
import { eventVenueLabel } from "@/lib/mandagroup-brands";
import { eventPixelBrand } from "@/lib/mandagroup-pixel";
import { dateParts, startTime } from "@/components/mandagroup/EventCard";

// Qué fechas se muestran a quien está leyendo una carta (aviso flotante y
// cierre de /carta/[id]). Quien escaneó el QR ya está en el local: lo que
// sirve es lo próximo del grupo, empezando por lo que se destacó en el panel
// y por lo de ese mismo local.

export type CartaVenue = "renaca" | "vina";

// Carta → local de Manda (las demás cartas muestran solo lo del grupo).
export const CARTA_VENUE: Record<string, CartaVenue> = {
  "manda-renaca": "renaca",
  manda: "vina",
};

export interface CartaPromoItem {
  id: string;
  title: string;
  ticketUrl: string;
  imageUrl: string | null;
  when: string; // "sáb 25 oct · 21:00"
  where: string; // "Manda Reñaca", "Eventos & Stand Up · Carbón"
  brand: string | null;
}

export function pickCartaPromos(events: MandagroupEvent[], venue?: CartaVenue, max = 3): MandagroupEvent[] {
  // Solo fechas que se pueden comprar y que son del grupo (los clubes o un
  // local del grupo, ej. Luis Jara en Carbón); lo destacado a mano entra igual.
  const isClub = (e: MandagroupEvent) => e.venue === "renaca" || e.venue === "vina";
  const usable = events.filter((e) => !e.soldOut && (e.featured || isClub(e) || eventPixelBrand(e) !== null));
  const local = (e: MandagroupEvent) => (venue ? e.venue === venue : isClub(e));

  // Mezcla, en orden de fecha dentro de cada criterio: lo destacado, la
  // próxima fiesta de este local y el próximo show del grupo fuera de los
  // clubes (stand up, conciertos en Carbón…); el resto se completa por fecha.
  const picks: MandagroupEvent[] = [];
  const add = (e?: MandagroupEvent) => {
    if (e && picks.length < max && !picks.includes(e)) picks.push(e);
  };
  usable.filter((e) => e.featured).forEach(add);
  add(usable.find(local));
  add(usable.find((e) => !isClub(e)));
  usable.filter(local).forEach(add);
  usable.forEach(add);
  return picks;
}

export function toPromoItem(e: MandagroupEvent): CartaPromoItem {
  const d = dateParts(e);
  const time = startTime(e);
  return {
    id: e.id,
    title: e.title,
    ticketUrl: e.ticketUrl,
    imageUrl: e.imageUrl ?? null,
    when: [`${d.weekday} ${d.day} ${d.month}`, time].filter(Boolean).join(" · "),
    where: eventVenueLabel(e),
    brand: eventPixelBrand(e),
  };
}
