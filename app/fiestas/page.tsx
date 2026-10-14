import type { Metadata } from "next";
import { ArrowUpRight } from "lucide-react";
import { clientConfig } from "@/config/client.config";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { WhatsAppButton } from "@/components/layout/WhatsAppButton";
import { Container } from "@/components/ui/Container";
import { Reveal } from "@/components/mandagroup/Reveal";
import { EventCard } from "@/components/mandagroup/EventCard";
import { SiblingLinks } from "@/components/mandagroup/BrandLanding";
import { listActiveEvents } from "@/lib/mandagroup-store";
import { splitEvents } from "@/lib/mandagroup-hero";
import { BRAND_PAGES, FIESTAS_PAGE } from "@/lib/mandagroup-pages";
import { buildFiestasJsonLd } from "@/lib/mandagroup-seo";
import { vestiCompanyUrl } from "@/lib/vesti";

// Cartelera completa del grupo en su propia página: la que puede aparecer
// cuando alguien busca "fiestas en Viña del Mar" o "qué hacer el sábado en
// Reñaca". Mismo origen que la home (Vesti + panel), regenerada cada 5 min.
export const revalidate = 300;

export const metadata: Metadata = {
  title: { absolute: FIESTAS_PAGE.title },
  description: FIESTAS_PAGE.description,
  alternates: { canonical: FIESTAS_PAGE.path },
  openGraph: {
    title: FIESTAS_PAGE.title,
    description: FIESTAS_PAGE.description,
    url: FIESTAS_PAGE.path,
    type: "website",
    locale: "es_CL",
    siteName: "Manda Group",
    images: [{ url: clientConfig.seo.ogImageUrl ?? "/clients/mandagroup/og-manda.jpg" }],
  },
};

const VESTI = [
  { venue: "renaca", label: "Manda Reñaca" },
  { venue: "vina", label: "Manda Viña del Mar" },
  { venue: "costa", label: "Costa Nights" },
  { venue: "standup", label: "Eventos & Stand Up" },
] as const;

export default async function FiestasPage() {
  const { contact, modules } = clientConfig;
  // Solo fiestas y shows: las promociones (ej. Cyber Days) van en la home.
  const events = splitEvents(await listActiveEvents()).nights;
  const jsonLd = buildFiestasJsonLd(events, FIESTAS_PAGE.faq);

  return (
    <>
      <Header config={clientConfig} />
      <main>
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
        />
        <section className="relative isolate overflow-hidden">
          <div className="absolute inset-0 -z-10 bg-gradient-to-b from-primary/[0.07] via-background to-background" />
          <Container className="py-16 sm:py-20 lg:py-24">
            <Reveal mode="load">
              <nav aria-label="Miga de pan" className="text-xs text-foreground/50">
                <a href="/" className="hover:text-primary">
                  Manda Group
                </a>
                <span aria-hidden> / </span>
                <span className="text-foreground/70">Fiestas</span>
              </nav>
              <p className="mt-6 text-xs font-semibold uppercase tracking-[0.3em] text-primary">Cartelera</p>
              <h1 className="mt-5 max-w-[20ch] text-balance font-heading text-5xl font-semibold leading-[1.04] tracking-tight text-foreground sm:text-6xl">
                {FIESTAS_PAGE.h1}
              </h1>
              <p className="mt-6 max-w-[60ch] text-lg leading-relaxed text-foreground/70">{FIESTAS_PAGE.intro}</p>
              <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm font-semibold">
                {VESTI.map((v) => (
                  <a
                    key={v.venue}
                    href={vestiCompanyUrl(v.venue)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-foreground/70 hover:text-primary"
                  >
                    {v.label} en Vesti
                    <ArrowUpRight size={14} strokeWidth={2} aria-hidden />
                  </a>
                ))}
              </div>
            </Reveal>
          </Container>
        </section>

        <section id="fechas" className="scroll-mt-24 pb-20 sm:pb-24">
          <Container>
            {events.length > 0 ? (
              <div className="grid gap-x-5 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
                {events.map((e, i) => (
                  <Reveal key={e.id} mode={i < 4 ? "load" : "scroll"} delay={(i % 4) * 80}>
                    <EventCard event={e} headingLevel="h2" />
                  </Reveal>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl bg-foreground/[0.04] p-10 ring-1 ring-foreground/10">
                <p className="font-heading text-xl font-semibold text-foreground">No hay fechas a la venta ahora mismo.</p>
                <p className="mt-2 text-foreground/60">Las próximas fiestas se publican en Instagram, @mandavina.cl y @manda.chile.</p>
              </div>
            )}
          </Container>
        </section>

        <section id="preguntas" className="scroll-mt-24 border-t border-foreground/10 py-20 sm:py-24">
          <Container className="grid gap-12 lg:grid-cols-12">
            <Reveal className="lg:col-span-4">
              <h2 className="max-w-[12ch] font-heading text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                Preguntas frecuentes
              </h2>
            </Reveal>
            <dl className="grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:col-span-8">
              {FIESTAS_PAGE.faq.map((f, i) => (
                <Reveal key={f.q} delay={(i % 2) * 80}>
                  <dt className="font-heading text-lg font-semibold leading-snug text-foreground">{f.q}</dt>
                  <dd className="mt-3 text-sm leading-relaxed text-foreground/65">{f.a}</dd>
                </Reveal>
              ))}
            </dl>
          </Container>
        </section>

        <SiblingLinks current="fiestas" siblings={BRAND_PAGES} />
      </main>
      <Footer config={clientConfig} />
      {modules.whatsappButton && contact.whatsapp ? (
        <WhatsAppButton phone={contact.whatsapp} message={contact.whatsappPrefilledMessage} />
      ) : null}
    </>
  );
}
