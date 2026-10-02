import Image from "next/image";
import { Container } from "@/components/ui/Container";
import type { ClientConfig } from "@/config/schema";

// Galería estilo portafolio de propiedades (ref: cards de Engel & Völkers):
// imágenes grandes 4:3 con zoom al hover y el nombre como pie de foto.
export function GalleryInmobiliaria({ images }: { images: NonNullable<ClientConfig["gallery"]> }) {
  return (
    <section id="propiedades" className="bg-foreground/[0.03] py-20 sm:py-28">
      <Container>
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">Propiedades</p>
        <h2 className="mt-3 font-heading text-3xl font-bold text-foreground sm:text-4xl">
          Propiedades destacadas
        </h2>
        <div className="mt-12 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {images.map((img) => (
            <figure key={img.url} className="group">
              <div className="relative aspect-[4/3] overflow-hidden">
                <Image
                  src={img.url}
                  alt={img.alt}
                  fill
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                />
              </div>
              <figcaption className="mt-3 border-b border-foreground/15 pb-3 text-sm font-medium uppercase tracking-wider text-foreground/80">
                {img.alt}
              </figcaption>
            </figure>
          ))}
        </div>
      </Container>
    </section>
  );
}
