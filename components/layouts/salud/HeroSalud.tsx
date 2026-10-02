import Image from "next/image";
import type { ClientConfig } from "@/config/schema";

// Hero editorial para clínicas/boutiques de salud: texto a la izquierda, foto
// real del espacio a la derecha con un filete en el color de acento detrás
// (marco descentrado, como una placa o vitrina) en vez del típico fondo
// oscurecido con texto encima — el espacio real es el protagonista, no una
// textura de fondo.
export function HeroSalud({ hero, rubro }: { hero: ClientConfig["hero"]; rubro: string }) {
  return (
    <section className="overflow-hidden bg-background py-16 sm:py-24">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:px-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-accent">{rubro}</p>
          <h1 className="mt-4 text-balance font-heading text-4xl font-bold leading-tight text-foreground sm:text-5xl">
            {hero.title}
          </h1>
          <p className="mt-6 max-w-md text-base leading-relaxed text-foreground/70 sm:text-lg">{hero.subtitle}</p>
          <div className="mt-10 flex flex-wrap items-center gap-4">
            <a
              href={hero.ctaHref}
              className="inline-flex items-center rounded-full bg-primary px-8 py-4 text-sm font-semibold text-white shadow-sm transition-transform hover:scale-[1.03]"
            >
              {hero.ctaLabel}
            </a>
            <a
              href="#servicios"
              className="inline-flex items-center text-sm font-semibold text-foreground/70 underline-offset-4 hover:text-primary hover:underline"
            >
              Ver especialidades
            </a>
          </div>
        </div>
        {hero.backgroundImageUrl && (
          <div className="relative mx-auto w-full max-w-md lg:max-w-none">
            <div
              aria-hidden
              className="absolute -bottom-5 -right-5 hidden aspect-[4/5] w-full rounded-[2rem] border-2 border-accent sm:block"
            />
            <div className="relative aspect-[4/5] w-full overflow-hidden rounded-[2rem]">
              <Image src={hero.backgroundImageUrl} alt="" fill priority className="object-cover" />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
