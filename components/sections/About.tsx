import Image from "next/image";
import { Container } from "@/components/ui/Container";
import type { ClientConfig } from "@/config/schema";

export function About({ about }: { about: ClientConfig["about"] }) {
  return (
    <section id="nosotros" className="py-16 sm:py-24">
      <Container className="grid items-center gap-10 lg:grid-cols-2">
        {about.imageUrl && (
          <Image
            src={about.imageUrl}
            alt={about.title}
            width={600}
            height={400}
            className="rounded-2xl object-cover"
          />
        )}
        <div>
          <h2 className="font-heading text-3xl font-bold text-foreground">{about.title}</h2>
          <p className="mt-4 whitespace-pre-line text-foreground/70">{about.body}</p>
        </div>
      </Container>
    </section>
  );
}
