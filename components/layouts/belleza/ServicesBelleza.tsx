import { Container } from "@/components/ui/Container";
import { Icon } from "@/components/ui/IconResolver";
import type { ClientConfig } from "@/config/schema";

// Lista editorial en vez de grilla de tarjetas: filetes finos, tipografía
// grande, un solo acento de color en el ícono — misma lógica de "exaggerated
// minimalism" que el hero (ver HeroBelleza.tsx).
export function ServicesBelleza({ services }: { services: ClientConfig["services"] }) {
  if (!services.length) return null;

  return (
    <section id="servicios" className="py-20 sm:py-28">
      <Container>
        <p className="text-center text-xs font-semibold uppercase tracking-[0.35em] text-accent">Servicios</p>
        <h2 className="mt-3 text-center font-heading text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          Lo que hacemos
        </h2>
        <div className="mt-16 border-t border-foreground/10">
          {services.map((s) => (
            <div
              key={s.title}
              className="flex flex-col gap-4 border-b border-foreground/10 py-8 sm:flex-row sm:items-center sm:gap-10"
            >
              <Icon name={s.icon} className="h-7 w-7 shrink-0 text-accent" />
              <h3 className="font-heading text-2xl font-semibold text-foreground sm:w-72 sm:shrink-0">{s.title}</h3>
              <p className="text-sm leading-relaxed text-foreground/60 sm:flex-1">{s.description}</p>
              {s.price && <p className="shrink-0 font-heading text-lg font-semibold text-accent">{s.price}</p>}
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
