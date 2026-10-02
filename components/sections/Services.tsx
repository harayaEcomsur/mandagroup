import { Container } from "@/components/ui/Container";
import { Icon } from "@/components/ui/IconResolver";
import type { ClientConfig } from "@/config/schema";

export function Services({ services }: { services: ClientConfig["services"] }) {
  if (!services.length) return null;

  return (
    <section id="servicios" className="py-16 sm:py-24">
      <Container>
        <h2 className="text-center font-heading text-3xl font-bold text-foreground">Servicios</h2>
        <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((s) => (
            <div
              key={s.title}
              className="rounded-2xl border border-black/5 p-6 shadow-sm transition-shadow hover:shadow-md"
            >
              <Icon name={s.icon} className="h-8 w-8 text-primary" />
              <h3 className="mt-4 font-heading text-lg font-semibold text-foreground">{s.title}</h3>
              <p className="mt-2 text-sm text-foreground/70">{s.description}</p>
              {s.price && <p className="mt-3 font-semibold text-accent">{s.price}</p>}
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
