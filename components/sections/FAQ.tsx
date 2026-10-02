import { Container } from "@/components/ui/Container";
import type { ClientConfig } from "@/config/schema";

export function FAQ({ items }: { items: NonNullable<ClientConfig["faq"]> }) {
  return (
    <section className="py-16 sm:py-24">
      <Container className="max-w-3xl">
        <h2 className="text-center font-heading text-3xl font-bold text-foreground">Preguntas frecuentes</h2>
        <div className="mt-10 space-y-3">
          {items.map((item) => (
            <details key={item.q} className="group rounded-xl border border-black/10 p-4">
              <summary className="cursor-pointer list-none font-medium text-foreground">{item.q}</summary>
              <p className="mt-2 text-foreground/70">{item.a}</p>
            </details>
          ))}
        </div>
      </Container>
    </section>
  );
}
