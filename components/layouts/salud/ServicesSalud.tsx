import { Container } from "@/components/ui/Container";
import { Icon } from "@/components/ui/IconResolver";
import type { ClientConfig } from "@/config/schema";

// Especialidades en tarjetas con ícono en círculo — más aire y menos "grilla
// de servicios" genérica que components/sections/Services.tsx, pensado para
// una clínica/boutique de salud donde cada especialidad es casi un servicio
// premium en sí mismo.
export function ServicesSalud({ services }: { services: ClientConfig["services"] }) {
  if (!services.length) return null;

  return (
    <section id="servicios" className="bg-primary/5 py-16 sm:py-24">
      <Container>
        <p className="text-center text-xs font-semibold uppercase tracking-[0.3em] text-accent">Especialidades</p>
        <h2 className="mt-3 text-center font-heading text-3xl font-bold text-foreground sm:text-4xl">
          Cómo podemos ayudarte
        </h2>
        <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((s) => (
            <div
              key={s.title}
              className="rounded-3xl border border-foreground/10 bg-background p-7 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                <Icon name={s.icon} className="h-6 w-6 text-primary" />
              </div>
              <h3 className="mt-5 font-heading text-lg font-semibold text-foreground">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-foreground/70">{s.description}</p>
              {s.price && <p className="mt-3 font-semibold text-accent">{s.price}</p>}
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
