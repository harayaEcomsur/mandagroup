"use client";

import Link from "next/link";
import { useLayoutEffect, useRef, useState } from "react";
import { ArrowLeft, Download, Minus, Plus, ZoomIn } from "lucide-react";

// Lector de carta a pantalla completa (/carta/[id]), pensado para el QR de la
// mesa: las cartas son pósters verticales con letra chica, así que el zoom va
// a la vista (botón "Agrandar") además del pellizco nativo del navegador.
// El zoom agranda el ancho de la imagen dentro de un contenedor con scroll
// horizontal: el desplazamiento sigue siendo el nativo del teléfono y se
// mantiene centrado en lo que se estaba leyendo.

const LEVELS = [1, 1.5, 2, 2.5];

export function CartaReader({
  title,
  pages,
  pdfUrl,
  siblings,
}: {
  title: string;
  pages: { src: string; width: number; height: number }[];
  pdfUrl: string;
  siblings: { id: string; label: string; active: boolean }[];
}) {
  const [level, setLevel] = useState(0);
  const scroller = useRef<HTMLDivElement>(null);
  const anchor = useRef<{ fy: number; fx: number } | null>(null);

  function zoomTo(next: number) {
    const el = scroller.current;
    if (!el || next < 0 || next >= LEVELS.length) return;
    // Punto de lectura actual (centro de la pantalla), como fracción de la carta.
    const rect = el.getBoundingClientRect();
    anchor.current = {
      fy: (window.innerHeight / 2 - rect.top) / rect.height,
      fx: (el.scrollLeft + el.clientWidth / 2) / el.scrollWidth,
    };
    setLevel(next);
    window.gtag?.("event", "zoom_carta", { carta: title, zoom: LEVELS[next] });
  }

  // Tras cambiar el ancho, vuelve a centrar ese mismo punto.
  useLayoutEffect(() => {
    const a = anchor.current;
    const el = scroller.current;
    if (!a || !el) return;
    anchor.current = null;
    const rect = el.getBoundingClientRect();
    window.scrollTo({ top: rect.top + window.scrollY + a.fy * rect.height - window.innerHeight / 2 });
    el.scrollLeft = a.fx * el.scrollWidth - el.clientWidth / 2;
  }, [level]);

  const zoom = LEVELS[level];

  return (
    <>
      <div className="sticky top-0 z-40 border-b border-foreground/10 bg-background/90 pt-[env(safe-area-inset-top)] backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-3 py-2 sm:px-4">
          <Link
            href="/"
            aria-label="Volver a Manda Group"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-foreground/80 hover:bg-foreground/5"
          >
            <ArrowLeft size={20} strokeWidth={2} />
          </Link>
          <h1 className="min-w-0 flex-1 truncate font-heading text-base font-semibold text-foreground sm:text-lg">{title}</h1>
          <a
            href={pdfUrl}
            target="_blank"
            rel="noreferrer"
            aria-label="Descargar la carta en PDF"
            className="flex h-10 shrink-0 items-center gap-1.5 rounded-full px-3 text-sm text-foreground/70 hover:bg-foreground/5 hover:text-foreground"
          >
            <Download size={16} strokeWidth={2} />
            PDF
          </a>
        </div>
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-3 pb-2 sm:px-4">
          {siblings.length > 1 ? (
            <nav aria-label="Cartas de Manda" className="flex rounded-full bg-foreground/[0.06] p-1 ring-1 ring-foreground/10">
              {siblings.map((s) => (
                <Link
                  key={s.id}
                  href={`/carta/${s.id}`}
                  aria-current={s.active ? "page" : undefined}
                  className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${
                    s.active ? "bg-primary text-background" : "text-foreground/70 hover:text-foreground"
                  }`}
                >
                  {s.label}
                </Link>
              ))}
            </nav>
          ) : (
            <span />
          )}
          {level === 0 ? (
            <button
              onClick={() => zoomTo(1)}
              className="flex h-10 items-center gap-2 rounded-full bg-foreground/[0.08] px-4 text-sm font-semibold text-foreground ring-1 ring-foreground/15 active:scale-[0.97]"
            >
              <ZoomIn size={17} strokeWidth={2} aria-hidden />
              Agrandar
            </button>
          ) : (
            <div className="flex items-center rounded-full bg-foreground/[0.08] ring-1 ring-foreground/15" role="group" aria-label="Zoom">
              <button onClick={() => zoomTo(level - 1)} aria-label="Achicar" className="flex h-10 w-10 items-center justify-center text-foreground">
                <Minus size={18} strokeWidth={2} />
              </button>
              <span className="w-12 text-center text-sm tabular-nums text-foreground/80" aria-live="polite">
                {Math.round(zoom * 100)}%
              </span>
              <button
                onClick={() => zoomTo(level + 1)}
                disabled={level === LEVELS.length - 1}
                aria-label="Agrandar"
                className="flex h-10 w-10 items-center justify-center text-foreground disabled:opacity-30"
              >
                <Plus size={18} strokeWidth={2} />
              </button>
            </div>
          )}
        </div>
      </div>

      <div ref={scroller} className="mx-auto max-w-3xl overflow-x-auto overscroll-x-contain">
        <div style={{ width: `${zoom * 100}%` }} className="flex flex-col">
          {pages.map((p, i) => (
            // eslint-disable-next-line @next/next/no-img-element -- WebP ya optimizados; el ancho cambia con el zoom
            <img
              key={p.src}
              src={p.src}
              alt={i === 0 ? title : ""}
              width={p.width}
              height={p.height}
              loading={i < 2 ? "eager" : "lazy"}
              fetchPriority={i === 0 ? "high" : undefined}
              decoding="async"
              className="block h-auto w-full"
            />
          ))}
        </div>
      </div>
    </>
  );
}
