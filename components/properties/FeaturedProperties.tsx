import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { PropertyCard, type Property } from "@/components/properties/PropertyCard";

// Reemplaza a la galería estática en la home cuando el módulo de propiedades está
// activo: inventario real (destacadas primero) con link al buscador completo.
export function FeaturedProperties({ properties }: { properties: Property[] }) {
  const featured = [...properties].sort((a, b) => Number(b.featured) - Number(a.featured)).slice(0, 6);

  return (
    <section id="propiedades" className="bg-foreground/[0.03] py-20 sm:py-28">
      <Container>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">Propiedades</p>
            <h2 className="mt-3 font-heading text-3xl font-bold text-foreground sm:text-4xl">
              Propiedades destacadas
            </h2>
          </div>
          <Link
            href="/propiedades"
            className="border border-foreground/30 px-6 py-3 text-sm font-semibold uppercase tracking-wider text-foreground hover:border-primary hover:text-primary"
          >
            Ver todas ({properties.length})
          </Link>
        </div>
        <div className="mt-12 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {featured.map((p) => (
            <PropertyCard key={p.slug} property={p} />
          ))}
        </div>
      </Container>
    </section>
  );
}
