import Image from "next/image";
import { Container } from "@/components/ui/Container";
import type { ClientConfig } from "@/config/schema";

export function Hero({ hero }: { hero: ClientConfig["hero"] }) {
  return (
    <section className="relative overflow-hidden bg-primary/5 py-20 sm:py-28">
      {hero.backgroundImageUrl && (
        <Image src={hero.backgroundImageUrl} alt="" fill priority className="object-cover opacity-20" />
      )}
      <Container className="relative text-center">
        <h1 className="font-heading text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          {hero.title}
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-foreground/70">{hero.subtitle}</p>
        <a
          href={hero.ctaHref}
          className="mt-8 inline-flex items-center rounded-full bg-primary px-6 py-3 font-medium text-white shadow-md transition-transform hover:scale-105"
        >
          {hero.ctaLabel}
        </a>
      </Container>
    </section>
  );
}
