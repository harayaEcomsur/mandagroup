import type { Metadata } from "next";
import { ArrowUpRight } from "lucide-react";
import { clientConfig } from "@/config/client.config";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { QR_MENU_LINKS } from "@/lib/mandagroup-cartas";
import { Reveal } from "@/components/mandagroup/Reveal";

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
      {/* Brillo dorado de fondo (solo CSS, sin imagen: esta página se abre
          escaneando un QR, con datos móviles). */}
      <main className="relative isolate overflow-hidden py-16 sm:py-24">
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-0 -z-10 h-[28rem] w-[44rem] -translate-x-1/2 -translate-y-1/3 rounded-full bg-primary/15 blur-3xl"
        />
        <div className="mx-auto max-w-xl px-4 sm:px-6">
          <Reveal mode="load">
            <h1 className="text-center font-heading text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
              Revisa nuestra carta
            </h1>
            <p className="mt-3 text-center text-foreground/60">Elige el restaurante.</p>
          </Reveal>
          <div className="mt-12 grid gap-4 sm:grid-cols-2">
            {QR_MENU_LINKS.map((m, i) => (
              <Reveal key={m.href} mode="load" delay={120 + i * 90}>
              <a
                href={m.href}
                target="_blank"
                rel="noreferrer"
                className="group flex h-full flex-col items-center gap-6 rounded-2xl bg-foreground/[0.06] px-6 py-9 text-center ring-1 ring-foreground/10 transition-[transform,background-color,box-shadow] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-1 hover:bg-foreground/[0.09] hover:ring-primary/40 active:scale-[0.98]"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- logo local chico */}
                <img src={m.logo} alt={m.name} className="h-24 w-auto max-w-[11rem] object-contain" />
                <span className="inline-flex items-center gap-3 rounded-full bg-primary py-1.5 pl-5 pr-1.5 text-sm font-semibold text-background">
                  Ver carta
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-background/15 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5">
                    <ArrowUpRight size={14} strokeWidth={2} aria-hidden />
                  </span>
                </span>
                {"external" in m && m.external && (
                  <span className="-mt-2 text-xs text-foreground/50">Menú online en {m.external}</span>
                )}
              </a>
              </Reveal>
            ))}
          </div>
        </div>
      </main>
      <Footer config={clientConfig} />
    </>
  );
}
