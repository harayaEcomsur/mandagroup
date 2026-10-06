import type { Metadata } from "next";
import { ArrowDown, ArrowUpRight, ExternalLink, FileText } from "lucide-react";
import { clientConfig } from "@/config/client.config";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { CartaView } from "@/components/mandagroup/CartaView";
import { CARTAS, CARTA_OPTIONS } from "@/lib/mandagroup-cartas";

export const metadata: Metadata = {
  title: "Cartas | Manda Group",
  description: "Cartas de Manda, Carbon y Costa Sushi.",
  alternates: { canonical: "/carta" },
};

// Arriba, las 3 cartas como opciones del mismo peso, cada una explicando cómo
// se abre (aquí mismo / PDF / sitio externo). Abajo, las que se leen en esta
// página. Antes Costa Sushi era un link suelto en una fila y parecía que no
// tenía carta.
export default function CartaPage() {
  return (
    <>
      <Header config={clientConfig} />
      <main className="py-14 sm:py-20">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <h1 className="font-heading text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">Nuestras cartas</h1>
          <p className="mt-3 max-w-[52ch] text-foreground/60">Elige el restaurante para ver su carta.</p>

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {CARTA_OPTIONS.map((o) => (
              <article
                key={o.key}
                className="flex flex-col rounded-2xl bg-foreground/[0.05] p-6 ring-1 ring-foreground/10"
              >
                <div className="flex items-center gap-4">
                  {/* eslint-disable-next-line @next/next/no-img-element -- logo local chico */}
                  <img src={o.logo} alt="" className="h-14 w-14 shrink-0 rounded-full bg-background object-contain p-1.5" />
                  <h2 className="font-heading text-2xl font-semibold text-foreground">{o.name}</h2>
                </div>
                <p className="mt-4 text-sm leading-relaxed text-foreground/60">{o.blurb}</p>

                {o.kind === "inline" ? (
                  <>
                    <a
                      href={`#${o.key}`}
                      className="mt-6 inline-flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-background transition-transform active:scale-[0.98]"
                    >
                      Ver carta aquí
                      <ArrowDown size={15} strokeWidth={2} />
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
                      className="mt-6 inline-flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-background transition-transform active:scale-[0.98]"
                    >
                      Abrir menú online
                      <ArrowUpRight size={15} strokeWidth={2} />
                    </a>
                    <p className="mt-4 inline-flex items-center gap-1.5 text-xs text-foreground/60">
                      <ExternalLink size={13} strokeWidth={2} />
                      Se abre en {o.host}, en otra pestaña
                    </p>
                  </>
                )}
              </article>
            ))}
          </div>

          <div className="mx-auto mt-24 flex max-w-3xl flex-col gap-20">
            {CARTAS.map((c) => (
              <CartaView key={c.key} carta={c} />
            ))}
          </div>
        </div>
      </main>
      <Footer config={clientConfig} />
    </>
  );
}
