import type { Metadata } from "next";
import { ArrowUpRight } from "lucide-react";
import { clientConfig } from "@/config/client.config";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { QR_MENU_LINKS } from "@/lib/mandagroup-cartas";

export const metadata: Metadata = {
  title: "Revisa nuestra carta | Carbon y Costa Sushi",
  description: "Carta de Carbon (carnes y parrilla) y carta de Costa Sushi.",
  alternates: { canonical: "/carbon" },
};

// mandagroup.cl/carbon existía en el sitio anterior (cPanel/WordPress) y hay
// QR impresos en las mesas apuntando ahí. Replica esa página tal cual: las
// mismas dos opciones, con los mismos destinos — la carta de Carbon (PDF) y
// la carta de Costa Sushi (menú en Fudo).
export default function CarbonPage() {
  return (
    <>
      <Header config={clientConfig} />
      <main className="py-16 sm:py-24">
        <div className="mx-auto max-w-xl px-4 sm:px-6">
          <h1 className="text-center font-heading text-3xl font-semibold uppercase tracking-[0.12em] text-foreground sm:text-4xl">
            Revisa nuestra carta
          </h1>
          <div className="mt-12 grid gap-4 sm:grid-cols-2">
            {QR_MENU_LINKS.map((m) => (
              <a
                key={m.href}
                href={m.href}
                target="_blank"
                rel="noreferrer"
                className="group flex flex-col items-center gap-5 rounded-2xl bg-foreground/[0.06] px-6 py-8 text-center ring-1 ring-foreground/10 hover:bg-foreground/[0.09] transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-1 active:scale-[0.98]"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- logo local chico */}
                <img src={m.logo} alt={m.name} className="h-24 w-auto max-w-[11rem] object-contain" />
                <span className="inline-flex items-center gap-2 text-sm font-semibold text-foreground group-hover:text-primary">
                  Ver carta {m.name}
                  <ArrowUpRight size={15} strokeWidth={2} />
                </span>
              </a>
            ))}
          </div>
        </div>
      </main>
      <Footer config={clientConfig} />
    </>
  );
}
