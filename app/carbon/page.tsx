import type { Metadata } from "next";
import { clientConfig } from "@/config/client.config";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { CartaView } from "@/components/mandagroup/CartaView";
import { CARTAS } from "@/lib/mandagroup-cartas";

export const metadata: Metadata = {
  title: "Carta Carbon | Manda Group",
  description: "Carta de Carbon: carnes y parrilla.",
  alternates: { canonical: "/carbon" },
};

// mandagroup.cl/carbon existía en el sitio anterior (cPanel) y hay QR impresos
// apuntando ahí: abre la carta de Carbon directo, sin pasos intermedios.
export default function CarbonPage() {
  const carta = CARTAS.find((c) => c.key === "carbon")!;
  return (
    <>
      <Header config={clientConfig} />
      <main className="py-14 sm:py-20">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <h1 className="sr-only">Carta Carbon</h1>
          <CartaView carta={carta} priority />
        </div>
      </main>
      <Footer config={clientConfig} />
    </>
  );
}
