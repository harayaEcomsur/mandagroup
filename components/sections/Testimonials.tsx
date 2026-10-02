import { Star } from "lucide-react";
import { Container } from "@/components/ui/Container";
import type { ClientConfig } from "@/config/schema";

export function Testimonials({ testimonials }: { testimonials: NonNullable<ClientConfig["testimonials"]> }) {
  return (
    <section className="bg-primary/5 py-16 sm:py-24">
      <Container>
        <h2 className="text-center font-heading text-3xl font-bold text-foreground">
          Lo que dicen nuestros clientes
        </h2>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {testimonials.map((t) => (
            <figure key={t.name} className="rounded-2xl bg-background p-6 shadow-sm">
              {t.rating && (
                <div className="mb-2 flex gap-0.5 text-accent">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} size={16} fill={i < t.rating! ? "currentColor" : "none"} />
                  ))}
                </div>
              )}
              <blockquote className="text-foreground/80">&ldquo;{t.quote}&rdquo;</blockquote>
              <figcaption className="mt-4 font-medium text-foreground">{t.name}</figcaption>
            </figure>
          ))}
        </div>
      </Container>
    </section>
  );
}
