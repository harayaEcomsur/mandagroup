import { Container } from "@/components/ui/Container";
import type { ClientConfig } from "@/config/schema";

// Áreas de práctica numeradas estilo estudio jurídico: "01, 02, 03…" en dos
// columnas con divisores finos y nombres en mayúsculas — sin cards ni íconos.
export function ServicesCorporativo({ services }: { services: ClientConfig["services"] }) {
  if (!services.length) return null;

  return (
    <section id="servicios" className="py-20 sm:py-28">
      <Container>
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">Áreas de práctica</p>
        <h2 className="mt-3 max-w-2xl font-heading text-3xl font-bold text-foreground sm:text-4xl">
          En qué podemos ayudarte
        </h2>
        <div className="mt-12 grid grid-cols-1 gap-x-16 lg:grid-cols-2">
          {services.map((s, i) => (
            <div key={s.title} className="flex gap-6 border-b border-foreground/15 py-7">
              <span className="font-heading text-sm font-semibold tabular-nums text-primary">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div>
                <h3 className="font-heading text-base font-semibold uppercase tracking-wider text-foreground">
                  {s.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-foreground/70">{s.description}</p>
                {s.price && <p className="mt-2 text-sm font-semibold text-primary">{s.price}</p>}
              </div>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
