import Image from "next/image";
import type { ClientConfig } from "@/config/schema";

// "Exaggerated minimalism" verificado con ui-ux-pro-max para belleza/spa/lujo:
// tipografía enorme, altísimo contraste, un solo acento de color, foto real a
// sangre completa (sin bordes redondeados — filo recto = editorial). El texto
// va SOBRE la foto, centrado: un scrim oscuro PAREJO (no en degradé, que
// dejaba tramos de la foto casi sin oscurecer y el texto se leía mal ahí) +
// un blur suave sobre la foto para que el texto se note nítido en cualquier
// punto de la imagen, no solo donde el fondo ayuda.
export function HeroBelleza({ hero, rubro }: { hero: ClientConfig["hero"]; rubro: string }) {
  return (
    <section className="relative min-h-[85vh] w-full overflow-hidden bg-foreground sm:min-h-screen">
      {hero.backgroundImageUrl && (
        <Image
          src={hero.backgroundImageUrl}
          alt=""
          fill
          priority
          className="object-cover blur-[2px] scale-105"
        />
      )}
      <div aria-hidden className="absolute inset-0 bg-black/55" />
      <div className="relative flex min-h-[85vh] flex-col items-center justify-center px-4 py-16 text-center sm:min-h-screen sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-accent">{rubro}</p>
        <h1 className="mt-6 text-balance font-heading text-5xl font-bold leading-[0.95] tracking-tight text-white sm:text-7xl lg:text-8xl">
          {hero.title}
        </h1>
        <p className="mx-auto mt-8 max-w-lg text-base leading-relaxed text-white/80 sm:text-lg">
          {hero.subtitle}
        </p>
        <a
          href={hero.ctaHref}
          className="mt-10 inline-flex items-center border-b-2 border-accent pb-1 text-sm font-semibold uppercase tracking-[0.2em] text-white transition-opacity hover:opacity-70"
        >
          {hero.ctaLabel}
        </a>
      </div>
    </section>
  );
}
