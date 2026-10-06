import Image from "next/image";
import { ArrowUpRight } from "lucide-react";
import type { Carta } from "@/lib/mandagroup-cartas";

// Una carta lista para leer en el celular: sus páginas como imagen (la
// primera con prioridad, el resto lazy) y el PDF original para descargar.
export function CartaView({ carta, priority = false }: { carta: Carta; priority?: boolean }) {
  return (
    <section id={carta.key} className="scroll-mt-24">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-center gap-4">
          {carta.logos.map((l) => (
            // eslint-disable-next-line @next/next/no-img-element -- logo local chico
            <img
              key={l.src}
              src={l.src}
              alt={l.alt}
              className={`h-14 w-14 rounded-full object-contain p-1.5 ${l.light ? "bg-[#F2EFE9]" : "bg-foreground/[0.06]"}`}
            />
          ))}
          <div>
            <h2 className="font-heading text-3xl font-semibold tracking-tight text-foreground">{carta.name}</h2>
            <p className="mt-1 text-sm text-foreground/60">{carta.description}</p>
          </div>
        </div>
        <a
          href={carta.pdf}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:text-accent"
        >
          Descargar PDF
          <ArrowUpRight size={15} strokeWidth={2} />
        </a>
      </div>
      <div className="mt-8 flex flex-col gap-4">
        {carta.pages.map((p, i) => (
          <Image
            key={p.src}
            src={p.src}
            alt={`${carta.name}, página ${i + 1}`}
            width={p.width}
            height={p.height}
            sizes="(min-width: 768px) 720px, 100vw"
            priority={priority && i === 0}
            // Ya son WebP optimizados a 1200 px (ver lib/mandagroup-cartas):
            // pasarlos por el optimizador solo agrega espera, sobre todo la
            // carta de Manda (6.882 px de alto). Van directo, cacheados por la CDN.
            unoptimized
            className="h-auto w-full rounded-2xl ring-1 ring-foreground/10"
          />
        ))}
      </div>
    </section>
  );
}
