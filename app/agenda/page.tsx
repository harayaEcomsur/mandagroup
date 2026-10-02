import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { clientConfig } from "@/config/client.config";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { ChatWidget } from "@/components/chat/ChatWidget";
import { BookingFlow } from "@/components/agenda/BookingFlow";
import { getServicePrices } from "@/lib/booking-store";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `Agenda tu hora — ${clientConfig.meta.businessName}`,
  description: `Reserva online en ${clientConfig.meta.businessName}: elige servicio, día y hora.`,
};

export default async function AgendaPage({ searchParams }: { searchParams: { servicio?: string } }) {
  const { modules, services, booking } = clientConfig;
  if (!modules.agenda) notFound();

  const priceOverrides = await getServicePrices();

  return (
    <>
      <Header config={clientConfig} />
      <main className="py-14 sm:py-20">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">Agenda online</p>
          <h1 className="mt-3 font-heading text-3xl font-bold text-foreground sm:text-4xl">Reserva tu hora</h1>
          <p className="mt-3 max-w-xl text-foreground/70">
            Elige el servicio, el día y la hora que te acomode — tu reserva queda tomada al instante
            y la confirmamos con el abono.
          </p>
          <div className="mt-10">
            <Suspense>
              <BookingFlow
                services={services.map((s) => ({ title: s.title, price: priceOverrides[s.title] ?? s.price }))}
                daysAhead={booking?.daysAhead ?? 14}
                depositNote={booking?.depositNote ?? "Para confirmar tu hora se solicita un abono."}
                initialService={searchParams.servicio}
                depositAmount={booking?.depositAmount}
              />
            </Suspense>
          </div>
        </div>
      </main>
      <Footer config={clientConfig} />
      {modules.chat ? <ChatWidget businessName={clientConfig.meta.businessName} stacked={false} /> : null}
    </>
  );
}
