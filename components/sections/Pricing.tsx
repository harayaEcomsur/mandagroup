import { Check } from "lucide-react";
import { Container } from "@/components/ui/Container";
import type { ClientConfig } from "@/config/schema";

export function Pricing({ plans }: { plans: NonNullable<ClientConfig["pricing"]> }) {
  return (
    <section id="precios" className="py-16 sm:py-24">
      <Container>
        <h2 className="text-center font-heading text-3xl font-bold text-foreground">Precios</h2>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`rounded-2xl border p-6 ${plan.highlighted ? "border-primary shadow-lg" : "border-black/10"}`}
            >
              <h3 className="font-heading text-xl font-semibold text-foreground">{plan.name}</h3>
              <p className="mt-2 text-3xl font-bold text-primary">{plan.price}</p>
              <ul className="mt-4 space-y-2">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-foreground/70">
                    <Check size={16} className="text-primary" /> {f}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
