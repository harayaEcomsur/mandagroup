import type { Metadata } from "next";
import { ArrowDown, ArrowUpRight, ExternalLink, FileText } from "lucide-react";
import { clientConfig } from "@/config/client.config";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { CartaView } from "@/components/mandagroup/CartaView";
import { CartaNav } from "@/components/mandagroup/CartaNav";
import { Reveal } from "@/components/mandagroup/Reveal";
import { BRAND_LOGO, hostOf, listCartas } from "@/lib/mandagroup-catalog";

export const metadata: Metadata = {
  title: "Cartas | Manda Group",
  description: "Cartas de Manda, Carbon y Costa Sushi.",
  alternates: { canonical: "/carta" },
};

// Las cartas se administran en /eventos/admin (archivo PDF o link externo);
// el panel regenera esta página al guardar. Respaldo: cada 10 min.
export const revalidate = 600;

// Arriba, todas las cartas como opciones del mismo peso, cada una diciendo
// cómo se abre (aquí mismo / PDF / sitio externo). Abajo, las que se leen en
// esta página (las de archivo).
export default async function CartaPage() {
  const cartas = (await listCartas()).filter((c) => c.showOnSite);
  const inline = cartas.filter((c) => c.source.type === "file");
  const external = cartas.filter((c) => c.source.type === "url");

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
            {cartas.map((c, i) => (
              <Reveal
                key={c.id}
                as="article"
                mode="load"
                delay={120 + Math.min(i, 5) * 70}
                className="flex flex-col rounded-2xl bg-foreground/[0.05] p-6 ring-1 ring-foreground/10 transition-[transform,box-shadow] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-1 hover:ring-primary/40"
              >
                <div className="flex items-center gap-4">
                  {/* eslint-disable-next-line @next/next/no-img-element -- logo local chico */}
                  <img src={BRAND_LOGO[c.brand]} alt="" className="h-16 w-16 shrink-0 rounded-full bg-background object-contain p-2" />
                  <h2 className="font-heading text-xl font-semibold leading-snug text-foreground">{c.title}</h2>
                </div>
                {c.description && <p className="mt-4 text-sm leading-relaxed text-foreground/60">{c.description}</p>}

                {c.source.type === "file" ? (
                  <>
                    <a
                      href={`#${c.id}`}
                      className="group mt-6 inline-flex items-center justify-between gap-3 rounded-full bg-primary py-1.5 pl-5 pr-1.5 text-sm font-semibold text-background transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 active:scale-[0.98]"
                    >
                      Ver carta aquí
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-background/15 transition-transform duration-300 group-hover:translate-y-0.5">
                        <ArrowDown size={14} strokeWidth={2} aria-hidden />
                      </span>
                    </a>
                    <a
                      href={c.source.url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-4 inline-flex items-center gap-1.5 text-xs text-foreground/60 hover:text-primary"
                    >
                      <FileText size={13} strokeWidth={2} aria-hidden />
                      Descargar PDF
                      {c.source.sizeBytes ? ` (${(c.source.sizeBytes / 1048576).toFixed(1).replace(".", ",")} MB)` : ""}
                    </a>
                  </>
                ) : (
                  <>
                    <a
                      href={c.source.url}
                      target="_blank"
                      rel="noreferrer"
                      className="group mt-6 inline-flex items-center justify-between gap-3 rounded-full bg-primary py-1.5 pl-5 pr-1.5 text-sm font-semibold text-background transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 active:scale-[0.98]"
                    >
                      Abrir menú online
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-background/15 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5">
                        <ArrowUpRight size={14} strokeWidth={2} aria-hidden />
                      </span>
                    </a>
                    <p className="mt-4 inline-flex items-center gap-1.5 text-xs text-foreground/60">
                      <ExternalLink size={13} strokeWidth={2} aria-hidden />
                      Se abre en {hostOf(c.source.url)}, en otra pestaña
                    </p>
                  </>
                )}
              </Reveal>
            ))}
          </div>

          {inline.length > 0 && (
            <div className="mx-auto mt-20 max-w-3xl">
              <CartaNav
                sections={inline.map((c) => ({ id: c.id, label: c.title.replace(/^Carta /, "") }))}
                externals={external.map((c) => ({ label: c.title.replace(/^Carta /, ""), href: c.source.url }))}
              />
              <div className="mt-10 flex flex-col gap-20">
                {inline.map((c) => (
                  <CartaView key={c.id} carta={c} />
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
      <Footer config={clientConfig} />
    </>
  );
}
