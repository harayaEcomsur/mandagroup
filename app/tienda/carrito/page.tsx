import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { clientConfig } from "@/config/client.config";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { CartProvider } from "@/components/store/CartProvider";
import { CheckoutView } from "@/components/store/CheckoutView";

export const metadata: Metadata = {
  title: `Carrito — ${clientConfig.meta.businessName}`,
};

export default function CarritoPage() {
  const { modules, store, meta } = clientConfig;
  if (!modules.tienda || !store) notFound();

  return (
    <>
      <Header config={clientConfig} />
      <main className="py-14 sm:py-20">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">Tienda online</p>
          <h1 className="mt-3 font-heading text-3xl font-bold text-foreground sm:text-4xl">Tu carrito</h1>
          <div className="mt-10">
            <CartProvider storageKey={`cart:${meta.slug}`}>
              <CheckoutView shippingNote={store.shippingNote} testMode={process.env.TBK_ENV !== "produccion"} />
            </CartProvider>
          </div>
        </div>
      </main>
      <Footer config={clientConfig} />
    </>
  );
}
