import type { Metadata } from "next";
import { clientConfig } from "@/config/client.config";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { CartaView } from "@/components/mandagroup/CartaView";
import { CARTAS } from "@/lib/mandagroup-cartas";

export const metadata: Metadata = {
  title: "Cartas | Manda Group",
  description: "Carta de Manda y carta de Carbon: tablas, quesadillas, carnes y parrilla.",
  alternates: { canonical: "/carta" },
};

export default function CartaPage() {
  return (
    <>
      <Header config={clientConfig} />
      <main className="py-14 sm:py-20">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <h1 className="font-heading text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">Nuestras cartas</h1>
          <nav className="mt-6 flex gap-5 text-sm font-semibold">
            {CARTAS.map((c) => (
              <a key={c.key} href={`#${c.key}`} className="text-foreground/70 hover:text-primary">
                {c.name}
              </a>
            ))}
          </nav>
          <div className="mt-12 flex flex-col gap-20">
            {CARTAS.map((c, i) => (
              <CartaView key={c.key} carta={c} priority={i === 0} />
            ))}
          </div>
        </div>
      </main>
      <Footer config={clientConfig} />
    </>
  );
}
