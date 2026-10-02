import Image from "next/image";
import { Container } from "@/components/ui/Container";
import type { ClientConfig } from "@/config/schema";

export function Gallery({ images }: { images: NonNullable<ClientConfig["gallery"]> }) {
  return (
    <section className="py-16 sm:py-24">
      <Container>
        <h2 className="text-center font-heading text-3xl font-bold text-foreground">Galería</h2>
        <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {images.map((img) => (
            <div key={img.url} className="relative aspect-square overflow-hidden rounded-xl">
              <Image src={img.url} alt={img.alt} fill className="object-cover" />
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
