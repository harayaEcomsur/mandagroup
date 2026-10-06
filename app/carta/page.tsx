import type { Metadata } from "next";
import { ArrowDown, ArrowUpRight, ExternalLink, FileText } from "lucide-react";
import { clientConfig } from "@/config/client.config";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { CartaView } from "@/components/mandagroup/CartaView";
import { CartaNav } from "@/components/mandagroup/CartaNav";
import { Reveal } from "@/components/mandagroup/Reveal";
import { CARTAS, CARTA_OPTIONS, type CartaOption } from "@/lib/mandagroup-cartas";

export const metadata: Metadata = {
  title: "Cartas | Manda Group",
  description: "Cartas de Manda, Carbon y Costa Sushi.",
  alternates: { canonical: "/carta" },
};

// Arriba, las 3 cartas como opciones del mismo peso, cada una explicando cómo
// se abre (aquí mismo / PDF / sitio externo). Abajo, las que se leen en esta
// página. Antes Costa Sushi era un link suelto en una fila y parecía que no
// tenía carta.
// La carta externa (Costa Sushi, en Fudo) también va en la barra fija.
const costaSushi = CARTA_OPTIONS.find((o): o is Extract<CartaOption, { kind: "external" }> => o.kind === "external")!;

export default function CartaPage() {
  return (
    <>
      <Header config={clientConfig} />
      <main className="py-14 sm:py-20">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <Reveal mode="load">
            <h1 className="font-heading text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">Nuestras cartas</h1>
            <p className="mt-3 max-w-[52ch] text-foreground/60">Elige el restaurante para ver su carta.</p>
          </Reveal>

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {CARTA_OPTIONS.map((o, i) => (
              <Reveal
                key={o.key}
                as="article"
                mode="load"
                delay={120 + i * 90}
                className="flex flex-col rounded-2xl bg-foreground/[0.05] p-6 ring-1 ring-foreground/10 transition-[transform,box-shadow] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-1 hover:ring-primary/40"
              >
                <div className="flex items-center gap-4">
                  {/* eslint-disable-next-line @next/next/no-img-element -- logo local chico */}
                  <img src={o.logo} alt="" className="h-16 w-16 shrink-0 rounded-full bg-background object-contain p-2" />
                  <h2 className="font-heading text-2xl font-semibold text-foreground">{o.name}</h2>
                </div>
                <p className="mt-4 text-sm leading-relaxed text-foreground/60">{o.blurb}</p>

                {o.kind === "inline" ? (
                  <>
                    <a
                      href={`#${o.key}`}
                      className="group mt-6 inline-flex items-center justify-between gap-3 rounded-full bg-primary py-1.5 pl-5 pr-1.5 text-sm font-semibold text-background transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 active:scale-[0.98]"
                    >
                      Ver carta aquí
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-background/15 transition-transform duration-300 group-hover:translate-y-0.5">
                        <ArrowDown size={14} strokeWidth={2} aria-hidden />
                      </span>
                    </a>
                    <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-foreground/60">
                      <a href={o.pdf.href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 hover:text-primary">
                        <FileText size={13} strokeWidth={2} />
                        Descargar PDF ({o.pdf.size})
                      </a>
                      {o.extra?.map((x) => (
                        <a key={x.href} href={x.href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 hover:text-primary">
                          <FileText size={13} strokeWidth={2} />
                          {x.label}
                        </a>
                      ))}
                    </div>
                  </>
                ) : (
                  <>
                    <a
                      href={o.href}
                      target="_blank"
                      rel="noreferrer"
                      className="group mt-6 inline-flex items-center justify-between gap-3 rounded-full bg-primary py-1.5 pl-5 pr-1.5 text-sm font-semibold text-background transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 active:scale-[0.98]"
                    >
                      Abrir menú online
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-background/15 transition-transform duration-300 group-hover:translate-y-0.5">
                        <ArrowUpRight size={14} strokeWidth={2} aria-hidden />
                      </span>
                    </a>
                    <p className="mt-4 inline-flex items-center gap-1.5 text-xs text-foreground/60">
                      <ExternalLink size={13} strokeWidth={2} />
                      Se abre en {o.host}, en otra pestaña
                    </p>
                  </>
                )}
              </Reveal>
            ))}
          </div>

          <div className="mx-auto mt-20 max-w-3xl">
            <CartaNav
              sections={CARTAS.map((c) => ({ id: c.key, label: c.name.replace("Carta ", "") }))}
              external={{ label: costaSushi.name, href: costaSushi.href }}
            />
            <div className="mt-10 flex flex-col gap-20">
              {CARTAS.map((c) => (
                <CartaView key={c.key} carta={c} />
              ))}
            </div>
          </div>
        </div>
      </main>
      <Footer config={clientConfig} />
    </>
  );
}
