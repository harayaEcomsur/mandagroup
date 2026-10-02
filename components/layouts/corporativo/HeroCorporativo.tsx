import Image from "next/image";
import type { ClientConfig } from "@/config/schema";

// Hero estilo estudio jurídico/consultora (ref: grandes estudios chilenos):
// banda oscura sobria de ancho completo, filete superior fino, eyebrow en
// mayúsculas y titular grande a la izquierda; la imagen queda como textura
// lateral tenue en pantallas grandes, no como protagonista.
export function HeroCorporativo({ hero, rubro }: { hero: ClientConfig["hero"]; rubro: string }) {
  return (
    <section className="relative overflow-hidden bg-foreground text-background">
      {hero.backgroundImageUrl && (
        <div className="absolute inset-y-0 right-0 hidden w-1/2 lg:block">
          <Image src={hero.backgroundImageUrl} alt="" fill priority className="object-cover opacity-25" />
          <div className="absolute inset-0 bg-gradient-to-r from-foreground via-foreground/60 to-transparent" />
        </div>
      )}
      <div className="relative mx-auto max-w-6xl px-4 py-24 sm:px-6 sm:py-32">
        <div className="h-px w-16 bg-primary" />
        <p className="mt-6 text-xs font-semibold uppercase tracking-[0.3em] opacity-70">{rubro}</p>
        <h1 className="mt-4 max-w-2xl font-heading text-4xl font-bold leading-tight sm:text-5xl">
          {hero.title}
        </h1>
        <p className="mt-6 max-w-xl text-base leading-relaxed opacity-80 sm:text-lg">{hero.subtitle}</p>
        <div className="mt-10 flex flex-wrap items-center gap-4">
          <a
            href={hero.ctaHref}
            className="inline-flex items-center bg-primary px-7 py-3.5 text-sm font-semibold uppercase tracking-wider text-white transition-colors hover:opacity-90"
          >
            {hero.ctaLabel}
          </a>
          <a
            href="#servicios"
            className="inline-flex items-center text-sm font-semibold uppercase tracking-wider underline-offset-8 hover:underline"
          >
            Áreas de práctica →
          </a>
        </div>
      </div>
    </section>
  );
}
