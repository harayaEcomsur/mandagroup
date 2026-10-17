import { SafeImage } from "@/components/mandagroup/SafeImage";
import { ArrowUpRight } from "lucide-react";
import type { MandagroupEvent } from "@/lib/mandagroup-store";
import { eventVenueLabel } from "@/lib/mandagroup-brands";
import { eventPixelBrand } from "@/lib/mandagroup-pixel";

// Tarjeta de una fecha de la cartelera (flyer, día, lugar, precio y link de
// compra en Vesti). La usan el riel de la home y las páginas de fiestas,
// clubes y restaurantes, para que una fecha se vea igual en todo el sitio.

const TZ = "America/Santiago";

export function dateParts(e: MandagroupEvent) {
  const d = new Date(e.eventDate + "T12:00:00");
  return {
    day: d.toLocaleDateString("es-CL", { day: "numeric" }),
    weekday: d.toLocaleDateString("es-CL", { weekday: "short" }).replace(".", ""),
    month: d.toLocaleDateString("es-CL", { month: "short" }).replace(".", ""),
    long: d.toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long" }),
  };
}

export function startTime(e: MandagroupEvent): string | null {
  if (!e.startsAt) return null;
  return new Date(e.startsAt).toLocaleTimeString("es-CL", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
}

// "2026-10-31" → "31 de octubre" (eventos de varios días, ej. Cyber Days).
export function untilDate(ymd: string): string {
  return new Date(ymd + "T12:00:00").toLocaleDateString("es-CL", { day: "numeric", month: "long" });
}

export function clp(n: number): string {
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(n);
}

// Sin flyer (o si no carga): el nombre de la fecha sobre el degradado de marca.
export function FlyerPlaceholder({ title, size = "lg" }: { title: string; size?: "lg" | "sm" }) {
  return (
    <div className={`absolute inset-0 flex flex-col justify-end bg-gradient-to-br from-primary/25 via-background to-background ${size === "lg" ? "p-6" : "p-3"}`}>
      <p className={`font-heading font-semibold leading-tight text-foreground ${size === "lg" ? "text-2xl" : "text-sm"}`}>{title}</p>
    </div>
  );
}

export function EventCard({ event: e, className = "", headingLevel = "h3" }: { event: MandagroupEvent; className?: string; headingLevel?: "h2" | "h3" }) {
  const d = dateParts(e);
  const time = startTime(e);
  const Heading = headingLevel;
  return (
    <article className={`group flex flex-col ${className}`}>
      <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-foreground/[0.05] ring-1 ring-foreground/10">
        {e.imageUrl ? (
          <SafeImage
            src={e.imageUrl}
            alt={`Flyer de ${e.title}`}
            fill
            sizes="19rem"
            className="object-cover transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.04]"
            fallback={<FlyerPlaceholder title={e.title} />}
          />
        ) : (
          <FlyerPlaceholder title={e.title} />
        )}
      </div>
      <div className="mt-4 flex gap-4">
        <div className="w-12 shrink-0 text-center">
          <p className="font-heading text-3xl font-semibold leading-none tabular-nums text-foreground">{d.day}</p>
          <p className="mt-1 text-xs capitalize text-foreground/60">
            {d.weekday} {d.month}
          </p>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-primary">{eventVenueLabel(e)}</p>
          <Heading className="mt-1 line-clamp-2 font-heading text-base font-semibold leading-snug text-foreground">{e.title}</Heading>
          <p className="mt-1 text-xs text-foreground/50">
            {[
              e.lastDate && e.lastDate !== e.eventDate ? `Hasta el ${untilDate(e.lastDate)}` : time && `${time} h`,
              e.soldOut ? "Agotado" : e.lowestPrice ? `Desde ${clp(e.lowestPrice)}` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
      </div>
      <a
        href={e.ticketUrl}
        data-pixel-event={e.title}
        data-pixel-brand={eventPixelBrand(e) ?? undefined}
        target="_blank"
        rel="noreferrer"
        className="mt-5 inline-flex items-center justify-center gap-2 rounded-full bg-foreground/[0.07] px-5 py-3 text-sm font-semibold text-foreground ring-1 ring-foreground/10 transition-colors duration-300 hover:bg-primary hover:text-background active:scale-[0.98]"
      >
        {e.soldOut ? "Ver en Vesti" : "Comprar entrada"}
        <ArrowUpRight size={15} strokeWidth={2} />
      </a>
    </article>
  );
}
