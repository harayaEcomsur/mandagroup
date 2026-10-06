"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight } from "lucide-react";

// Barra fija bajo el header en /carta: la carta de Manda mide ~7.000 px de
// alto, así que sin esto pasar a Carbon o a Costa Sushi obliga a volver
// arriba. Marca en qué carta vas (IntersectionObserver solo para resaltar —
// el contenido nunca depende de esto) y Costa Sushi se distingue como enlace
// externo.
export function CartaNav({
  sections,
  external,
}: {
  sections: { id: string; label: string }[];
  external: { label: string; href: string };
}) {
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    const els = sections.map((s) => document.getElementById(s.id)).filter(Boolean) as HTMLElement[];
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      // Cuenta como "la carta actual" la que cruza la franja superior de la pantalla.
      { rootMargin: "-30% 0px -60% 0px" }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [sections]);

  return (
    <nav
      aria-label="Cartas"
      className="sticky top-20 z-20 -mx-4 border-b border-foreground/10 bg-background/85 px-4 backdrop-blur-md sm:top-24 sm:-mx-6 sm:px-6"
    >
      <div className="flex gap-2 overflow-x-auto py-3 [scrollbar-width:none]">
        {sections.map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            aria-current={active === s.id ? "true" : undefined}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-colors duration-300 ${
              active === s.id
                ? "bg-primary text-background"
                : "bg-foreground/[0.06] text-foreground/70 hover:text-foreground"
            }`}
          >
            {s.label}
          </a>
        ))}
        <a
          href={external.href}
          target="_blank"
          rel="noreferrer"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold text-foreground/70 ring-1 ring-foreground/15 transition-colors duration-300 hover:text-primary hover:ring-primary/50"
        >
          {external.label}
          <ArrowUpRight size={14} strokeWidth={2} aria-hidden />
          <span className="sr-only">(sitio externo)</span>
        </a>
      </div>
    </nav>
  );
}
