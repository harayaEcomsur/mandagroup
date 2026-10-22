"use client";

import { useEffect, useState } from "react";
import { ChevronDown, X } from "lucide-react";
import type { CartaPromoItem } from "@/lib/mandagroup-carta-promos";

// Aviso flotante de próximas fechas mientras se lee la carta. Para no
// estorbar a quien solo quiere pedir:
// - no aparece al llegar: recién cuando la persona ya bajó por la carta o
//   pasaron unos segundos;
// - es una franja chica abajo (una fecha a la vez, rotando), nunca tapa la
//   carta entera; tocarla abre el detalle de hasta 3 fechas;
// - se cierra con la X y no vuelve en esa visita (sessionStorage);
// - el cierre de la página repite las fechas para quien llega al final.

const CLOSED_KEY = "mgCartaPromoClosed";
const SHOW_AFTER_MS = 8000;
const ROTATE_MS = 6000;

function wasClosed(): boolean {
  try {
    return sessionStorage.getItem(CLOSED_KEY) === "1";
  } catch {
    return false;
  }
}

function Thumb({ item, className }: { item: CartaPromoItem; className: string }) {
  return item.imageUrl ? (
    // eslint-disable-next-line @next/next/no-img-element -- miniatura del flyer (pasa por /api/img)
    <img
      src={`/api/img?url=${encodeURIComponent(item.imageUrl)}&w=160&q=70`}
      alt=""
      className={`${className} object-cover`}
      onError={(e) => (e.currentTarget.style.visibility = "hidden")}
    />
  ) : (
    <div className={`${className} bg-gradient-to-br from-primary/40 to-background`} />
  );
}

export function CartaPromo({ items, heading }: { items: CartaPromoItem[]; heading: string }) {
  const [visible, setVisible] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [index, setIndex] = useState(0);

  // Aparece tras bajar ~media pantalla o a los 8 s, lo que pase primero.
  useEffect(() => {
    if (items.length === 0 || wasClosed()) return;
    const show = () => setVisible(true);
    const timer = window.setTimeout(show, SHOW_AFTER_MS);
    const onScroll = () => {
      if (window.scrollY > window.innerHeight * 0.6) show();
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("scroll", onScroll);
    };
  }, [items.length]);

  useEffect(() => {
    if (visible) window.gtag?.("event", "view_promo", { promo_titles: items.map((i) => i.title).join(" | ").slice(0, 100) });
  }, [visible, items]);

  // Rota entre las fechas (sin animación si la persona pidió menos movimiento).
  useEffect(() => {
    if (!visible || expanded || items.length < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => setIndex((i) => (i + 1) % items.length), ROTATE_MS);
    return () => window.clearInterval(id);
  }, [visible, expanded, items.length]);

  if (!visible || items.length === 0) return null;

  function close() {
    try {
      sessionStorage.setItem(CLOSED_KEY, "1");
    } catch {
      // sin storage, solo se cierra ahora
    }
    window.gtag?.("event", "close_promo");
    setVisible(false);
  }

  const current = items[index % items.length];

  return (
    <>
      {expanded && (
        <button
          aria-label="Cerrar detalle"
          onClick={() => setExpanded(false)}
          className="fixed inset-0 z-40 bg-background/60 backdrop-blur-[2px] motion-safe:animate-[fadeIn_200ms_ease-out]"
        />
      )}
      <aside
        aria-label={heading}
        className="fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-50 mx-auto max-w-md overflow-hidden rounded-2xl bg-[#141417]/95 shadow-2xl shadow-black/50 ring-1 ring-foreground/15 backdrop-blur-md motion-safe:animate-[promoIn_420ms_cubic-bezier(0.16,1,0.3,1)]"
      >
        {expanded ? (
          <div className="p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">{heading}</p>
              <button
                onClick={() => setExpanded(false)}
                aria-label="Achicar aviso"
                className="-mr-1 flex h-9 w-9 items-center justify-center rounded-full text-foreground/60 hover:bg-foreground/5"
              >
                <ChevronDown size={18} />
              </button>
            </div>
            <ul className="mt-3 flex flex-col gap-3">
              {items.map((item) => (
                <li key={item.id} className="flex items-center gap-3">
                  <Thumb item={item} className="h-16 w-[3.2rem] shrink-0 rounded-lg" />
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm font-semibold leading-snug text-foreground">{item.title}</p>
                    <p className="mt-0.5 truncate text-xs capitalize text-foreground/60">
                      {item.when} · {item.where}
                    </p>
                  </div>
                  <a
                    href={item.ticketUrl}
                    target="_blank"
                    rel="noreferrer"
                    data-pixel-event={item.title}
                    data-pixel-brand={item.brand ?? undefined}
                    className="shrink-0 rounded-full bg-primary px-3.5 py-2 text-xs font-semibold text-background active:scale-[0.97]"
                  >
                    Entradas
                  </a>
                </li>
              ))}
            </ul>
            <a href="/#eventos" className="mt-4 block text-center text-xs text-foreground/60 underline underline-offset-4">
              Ver toda la cartelera
            </a>
          </div>
        ) : (
          <div className="flex items-center gap-3 p-2 pr-1.5">
            <button
              onClick={() => (items.length > 1 ? setExpanded(true) : undefined)}
              className="flex min-w-0 flex-1 items-center gap-3 text-left"
              aria-expanded={false}
              aria-label={items.length > 1 ? `Ver ${items.length} próximas fechas` : undefined}
            >
              <Thumb key={current.id} item={current} className="h-14 w-11 shrink-0 rounded-lg" />
              <span key={`t-${current.id}`} className="min-w-0 flex-1 motion-safe:animate-[fadeIn_300ms_ease-out]">
                <span className="block text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-primary">{heading}</span>
                <span className="block truncate text-sm font-semibold text-foreground">{current.title}</span>
                <span className="block truncate text-xs capitalize text-foreground/60">
                  {current.when} · {current.where}
                </span>
              </span>
            </button>
            <a
              href={current.ticketUrl}
              target="_blank"
              rel="noreferrer"
              data-pixel-event={current.title}
              data-pixel-brand={current.brand ?? undefined}
              className="shrink-0 rounded-full bg-primary px-3.5 py-2 text-xs font-semibold text-background active:scale-[0.97]"
            >
              Entradas
            </a>
            <button
              onClick={close}
              aria-label="Cerrar aviso"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-foreground/50 hover:bg-foreground/5 hover:text-foreground"
            >
              <X size={17} />
            </button>
          </div>
        )}
      </aside>
    </>
  );
}
