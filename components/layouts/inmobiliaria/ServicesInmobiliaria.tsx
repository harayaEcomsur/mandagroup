import { Container } from "@/components/ui/Container";
import { Icon } from "@/components/ui/IconResolver";
import type { ClientConfig } from "@/config/schema";

// Servicios estilo inmobiliaria premium: sin cards — lista aireada con líneas
// finas, títulos con tracking y encabezado de sección alineado a la izquierda.
export function ServicesInmobiliaria({ services }: { services: ClientConfig["services"] }) {
  if (!services.length) return null;

  return (
    <section id="servicios" className="py-20 sm:py-28">
      <Container>
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">Servicios</p>
        <h2 className="mt-3 max-w-2xl font-heading text-3xl font-bold text-foreground sm:text-4xl">
          Un servicio integral, de la tasación a la entrega de llaves
        </h2>
        <div className="mt-12 grid grid-cols-1 gap-x-12 gap-y-10 sm:grid-cols-2">
          {services.map((s) => (
            <div key={s.title} className="border-t border-foreground/15 pt-6">
              <div className="flex items-center gap-3">
                <Icon name={s.icon} className="h-5 w-5 text-primary" />
                <h3 className="font-heading text-base font-semibold uppercase tracking-wider text-foreground">
                  {s.title}
                </h3>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-foreground/70">{s.description}</p>
              {s.price && <p className="mt-2 text-sm font-semibold text-primary">{s.price}</p>}
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
