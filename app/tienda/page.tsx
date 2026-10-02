import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { clientConfig } from "@/config/client.config";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { ChatWidget } from "@/components/chat/ChatWidget";
import { CartProvider } from "@/components/store/CartProvider";
import { ProductCard } from "@/components/store/ProductCard";
import { CartBar } from "@/components/store/CartBar";

export const metadata: Metadata = {
  title: `Tienda — ${clientConfig.meta.businessName}`,
  description: `Compra online en ${clientConfig.meta.businessName} con Webpay: elige tus productos y paga en minutos.`,
};

export default function TiendaPage() {
  const { modules, store, meta } = clientConfig;
  if (!modules.tienda || !store) notFound();

  const products = store.products.filter((p) => p.available);

  return (
    <>
      <Header config={clientConfig} />
      <CartProvider storageKey={`cart:${meta.slug}`}>
        <main className="pb-28 pt-14 sm:pt-20">
          <div className="mx-auto max-w-5xl px-4 sm:px-6">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">Tienda online</p>
            <h1 className="mt-3 font-heading text-3xl font-bold text-foreground sm:text-4xl">Nuestros productos</h1>
            <p className="mt-3 max-w-xl text-foreground/70">
              Agrega lo que quieras al carrito y paga con Webpay — tarjetas de débito y crédito.
            </p>
            <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {products.map((p) => (
                <ProductCard key={p.slug} product={p} />
              ))}
            </div>
          </div>
        </main>
        <CartBar />
      </CartProvider>
      <Footer config={clientConfig} />
      {modules.chat ? <ChatWidget businessName={meta.businessName} stacked={false} /> : null}
    </>
  );
}
