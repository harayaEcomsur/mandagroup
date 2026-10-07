import Image from "next/image";
import { ArrowUpRight } from "lucide-react";
import { BRAND_LOGO, type Carta } from "@/lib/mandagroup-catalog";
import { Reveal } from "@/components/mandagroup/Reveal";
import { PdfViewer } from "@/components/mandagroup/PdfViewer";

// Una carta en PDF lista para leer en el celular: sus páginas en WebP si las
// hay (las cartas migradas, más livianas), o el PDF dibujado en la página
// (cualquier carta subida desde el panel); siempre con el PDF para descargar.
export function CartaView({ carta }: { carta: Carta }) {
  if (carta.source.type !== "file") return null;
  const { source } = carta;
  return (
    // scroll-mt: header fijo + barra de cartas (CartaNav) — el título no queda tapado.
    <section id={carta.id} className="scroll-mt-40 sm:scroll-mt-44">
      <Reveal className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element -- logo local chico */}
          <img src={BRAND_LOGO[carta.brand]} alt="" className="h-14 w-14 rounded-full bg-foreground/[0.06] object-contain p-1.5" />
          <div>
            <h2 className="font-heading text-3xl font-semibold tracking-tight text-foreground">{carta.title}</h2>
            {carta.description && <p className="mt-1 text-sm text-foreground/60">{carta.description}</p>}
          </div>
        </div>
        <a
          href={source.url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:text-accent"
        >
          Descargar PDF
          <ArrowUpRight size={15} strokeWidth={2} />
        </a>
      </Reveal>
      <div className="mt-8 flex flex-col gap-4">
        {source.pages?.length ? (
          source.pages.map((p, i) => (
            <Image
              key={p.src}
              src={p.src}
              alt={`${carta.title}, página ${i + 1}`}
              width={p.width}
              height={p.height}
              sizes="(min-width: 768px) 720px, 100vw"
              // Ya son WebP optimizados a 1200 px: pasarlos por el optimizador
              // solo agrega espera (la de Manda mide 6.882 px de alto).
              unoptimized
              className="h-auto w-full rounded-2xl ring-1 ring-foreground/10"
            />
          ))
        ) : (
          <PdfViewer url={source.url} title={carta.title} />
        )}
      </div>
    </section>
  );
}
