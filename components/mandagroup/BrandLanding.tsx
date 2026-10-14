import Image from "next/image";
import { ArrowUpRight, MapPin, QrCode } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { Reveal } from "@/components/mandagroup/Reveal";
import { EventCard } from "@/components/mandagroup/EventCard";
import { listActiveEvents, type MandagroupEvent } from "@/lib/mandagroup-store";
import { listCartas, listLocales, reservationLink, type Local } from "@/lib/mandagroup-catalog";
import { BRANDS } from "@/lib/mandagroup-brands";
import { BRAND_PAGES, FIESTAS_PAGE, brandPagePath, type BrandPage } from "@/lib/mandagroup-pages";
import { eventPixelBrand, localPixelBrand } from "@/lib/mandagroup-pixel";
import { getAccountMedia } from "@/lib/instagram";
import { splitEvents } from "@/lib/mandagroup-hero";
import { buildBrandPageJsonLd } from "@/lib/mandagroup-seo";

// Página de una marca (Carbón, Costa Sushi, Manda Reñaca, Manda Viña): la
// respuesta directa arriba (qué es, dónde está, cómo se reserva), sus locales
// con dirección y canal de reserva, sus fechas a la venta, la carta, las
// preguntas y los links al resto del grupo. Mismo lenguaje visual de la home.

function pageEvents(page: BrandPage, events: MandagroupEvent[]): MandagroupEvent[] {
  if (page.key === "renaca" || page.key === "vina") return events.filter((e) => e.venue === page.key);
  return events.filter((e) => eventPixelBrand(e) === page.key);
}

function pageLocales(page: BrandPage, locales: Local[]): Local[] {
  return locales.filter(
    (l) => l.showOnSite && l.brand === page.catalogBrand && (!page.localIds || page.localIds.includes(l.id))
  );
}

export async function loadBrandLanding(page: BrandPage) {
  const brand = BRANDS.find((b) => b.key === page.key)!;
  const [allEvents, allLocales, cartas, media] = await Promise.all([
    listActiveEvents(),
    listLocales(),
    listCartas(),
    getAccountMedia(process.env[brand.tokenEnv], 1),
  ]);
  const events = pageEvents(page, allEvents);
  const locales = pageLocales(page, allLocales);
  // Carta: solo las públicas (las de Carbon se ven por QR, nunca acá).
  const menus =
    page.menu === "public"
      ? cartas
          .filter((c) => c.showOnSite && c.brand === page.catalogBrand)
          .map((c) => ({
            id: c.id,
            title: c.title,
            external: c.source.type === "url",
            href: c.source.type === "url" ? c.source.url : `/carta#${c.id}`,
          }))
      : [];
  // Foto: la última de su Instagram; si no, su foto fija o el flyer de su
  // próxima fecha (no el de una promoción).
  const flyer = splitEvents(events).nights.find((e) => e.imageUrl)?.imageUrl;
  const image = media?.[0]?.mediaUrl ?? brand.fallbackImage ?? flyer ?? null;
  return { brand, events, locales, menus, image };
}

const btnPrimary =
  "group inline-flex items-center gap-3 rounded-full bg-primary py-2 pl-6 pr-2 text-sm font-semibold text-background transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 active:scale-[0.98]";
const btnArrow =
  "flex h-8 w-8 items-center justify-center rounded-full bg-background/15 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5";
const linkUnderline =
  "text-sm font-semibold text-foreground underline decoration-foreground/30 underline-offset-8 transition-colors hover:decoration-primary";

export async function BrandLanding({ page }: { page: BrandPage }) {
  const path = brandPagePath(page);
  const { brand, events, locales, menus, image } = await loadBrandLanding(page);
  const absoluteMenu = menus[0] ? (menus[0].external ? menus[0].href : undefined) : undefined;
  const jsonLd = buildBrandPageJsonLd({ page, path, locales, events, menuUrl: absoluteMenu });
  // Botón principal "Reservar" solo con un local; con varios (Costa Sushi)
  // cada tarjeta de local tiene el suyo y arriba va la carta.
  const firstReserva = locales.length === 1 ? locales.map((l) => ({ l, r: reservationLink(l) })).find((x) => x.r) : undefined;
  const siblings = BRAND_PAGES.filter((p) => p.key !== page.key);

  return (
    <>
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />

      {/* Hero: la respuesta directa (qué es y dónde) y la acción principal. */}
      <section className="relative isolate overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-primary/[0.07] via-background to-background" />
        <Container className="grid items-center gap-12 py-16 sm:py-20 lg:grid-cols-12 lg:py-24">
          <Reveal mode="load" className="lg:col-span-7">
            <nav aria-label="Miga de pan" className="text-xs text-foreground/50">
              <a href="/" className="hover:text-primary">
                Manda Group
              </a>
              <span aria-hidden> / </span>
              <span className="text-foreground/70">{page.name}</span>
            </nav>
            <p className="mt-6 text-xs font-semibold uppercase tracking-[0.3em] text-primary">{page.eyebrow}</p>
            <h1 className="mt-5 max-w-[20ch] text-balance font-heading text-5xl font-semibold leading-[1.04] tracking-tight text-foreground sm:text-6xl">
              {page.h1}
            </h1>
            <p className="mt-6 max-w-[56ch] text-lg leading-relaxed text-foreground/70">{page.intro}</p>
            <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-4">
              {firstReserva ? (
                <a
                  href={firstReserva.r!.href}
                  data-pixel-brand={localPixelBrand(firstReserva.l) ?? undefined}
                  target="_blank"
                  rel="noreferrer"
                  className={btnPrimary}
                >
                  Reservar mesa
                  <span className={btnArrow}>
                    <ArrowUpRight size={16} strokeWidth={2} />
                  </span>
                </a>
              ) : events.length > 0 && !(page.section === "restaurantes" && menus[0]) ? (
                <a href="#fechas" className={btnPrimary}>
                  Ver próximas fechas
                  <span className={btnArrow}>
                    <ArrowUpRight size={16} strokeWidth={2} />
                  </span>
                </a>
              ) : menus[0] ? (
                <a
                  href={menus[0].href}
                  data-pixel-brand={localPixelBrand({ id: menus[0].id, brand: page.catalogBrand }) ?? undefined}
                  {...(menus[0].external ? { target: "_blank", rel: "noreferrer" } : {})}
                  className={btnPrimary}
                >
                  Ver la carta
                  <span className={btnArrow}>
                    <ArrowUpRight size={16} strokeWidth={2} />
                  </span>
                </a>
              ) : null}
              <a href={`https://www.instagram.com/${brand.handle}/`} target="_blank" rel="noreferrer" className={linkUnderline}>
                Instagram @{brand.handle}
              </a>
            </div>
          </Reveal>
          <Reveal mode="load" delay={150} className="lg:col-span-5">
            <div className="relative aspect-[4/5] overflow-hidden rounded-[1.75rem] bg-foreground/[0.05] ring-1 ring-foreground/10">
              {image ? (
                <Image src={image} alt={page.name} fill priority sizes="(min-width: 1024px) 40vw, 100vw" className="object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center bg-gradient-to-br from-foreground/[0.08] via-background to-primary/10">
                  {/* eslint-disable-next-line @next/next/no-img-element -- logo local */}
                  <img src={brand.logo} alt="" className="h-36 w-36 object-contain opacity-90" />
                </div>
              )}
              <div className="absolute inset-x-0 bottom-0 flex items-center gap-3 bg-gradient-to-t from-background/90 to-transparent p-5">
                {/* eslint-disable-next-line @next/next/no-img-element -- logo local de la marca */}
                <img src={brand.logo} alt="" className="h-12 w-12 rounded-full bg-background/80 object-contain p-1" />
                <p className="font-heading text-lg font-semibold text-foreground">{page.name}</p>
              </div>
            </div>
          </Reveal>
        </Container>
      </section>

      {/* Lo que ofrece, en tres líneas. */}
      <section className="pb-20 sm:pb-24">
        <Container>
          <ul className="grid gap-4 sm:grid-cols-3">
            {page.highlights.map((h, i) => (
              <Reveal key={h.title} as="li" delay={i * 80} className="rounded-2xl bg-foreground/[0.04] p-6 ring-1 ring-foreground/10">
                <h2 className="font-heading text-lg font-semibold text-foreground">{h.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-foreground/65">{h.body}</p>
              </Reveal>
            ))}
          </ul>
        </Container>
      </section>

      {/* Locales: dirección, cómo llegar y canal de reserva (del panel). */}
      {locales.length > 0 && (
        <section id="locales" className="scroll-mt-24 border-t border-foreground/10 py-20 sm:py-24">
          <Container>
            <Reveal>
              <h2 className="font-heading text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                {locales.length > 1 ? "Locales" : "Dónde estamos"}
              </h2>
            </Reveal>
            <div className="mt-10 grid gap-4 sm:grid-cols-2">
              {locales.map((l, i) => {
                const reserva = reservationLink(l);
                return (
                  <Reveal key={l.id} delay={(i % 2) * 80} className="rounded-2xl bg-foreground/[0.04] p-6 ring-1 ring-foreground/10">
                    <h3 className="font-heading text-xl font-semibold text-foreground">{l.name}</h3>
                    {l.address && <p className="mt-1 text-sm text-foreground/60">{l.address}</p>}
                    {l.hours && <p className="mt-1 text-sm text-foreground/60">Horario: {l.hours}</p>}
                    {reserva ? (
                      <div className="mt-5">
                        <a
                          href={reserva.href}
                          data-pixel-brand={localPixelBrand(l) ?? undefined}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 rounded-full bg-foreground/[0.08] px-4 py-2.5 text-sm font-semibold text-foreground ring-1 ring-foreground/10 transition-colors duration-300 hover:bg-primary hover:text-background active:scale-[0.98]"
                        >
                          Reservar
                          <ArrowUpRight size={15} strokeWidth={2} aria-hidden />
                        </a>
                        <p className="mt-2 text-xs text-foreground/50">{reserva.via}</p>
                      </div>
                    ) : null}
                    {(l.mapsUrl || l.address) && (
                      <a
                        href={
                          l.mapsUrl ?? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${l.name} ${l.address}`)}`
                        }
                        target="_blank"
                        rel="noreferrer"
                        className="mt-4 flex items-center gap-2 text-sm font-semibold text-primary hover:text-accent"
                      >
                        <MapPin size={15} strokeWidth={2} aria-hidden />
                        Cómo llegar
                      </a>
                    )}
                  </Reveal>
                );
              })}
            </div>
          </Container>
        </section>
      )}

      {/* Fechas a la venta de esta marca (Vesti + panel). */}
      {(events.length > 0 || page.section === "clubes") && (
        <section id="fechas" className="scroll-mt-24 border-t border-foreground/10 py-20 sm:py-24">
          <Container>
            <Reveal className="flex flex-wrap items-end justify-between gap-6">
              <h2 className="font-heading text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">{page.eventsTitle}</h2>
              <a href={FIESTAS_PAGE.path} className={linkUnderline}>
                Toda la cartelera del grupo
              </a>
            </Reveal>
            {events.length > 0 ? (
              <div className="mt-10 grid gap-x-5 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
                {events.map((e, i) => (
                  <Reveal key={e.id} delay={(i % 4) * 80}>
                    <EventCard event={e} />
                  </Reveal>
                ))}
              </div>
            ) : (
              <div className="mt-10 rounded-2xl bg-foreground/[0.04] p-8 ring-1 ring-foreground/10">
                <p className="font-heading text-lg font-semibold text-foreground">No hay fechas a la venta ahora mismo.</p>
                <p className="mt-2 text-sm text-foreground/60">
                  Las próximas fiestas se publican en Instagram, @{brand.handle}.
                </p>
              </div>
            )}
          </Container>
        </section>
      )}

      {/* Carta */}
      <section id="carta" className="scroll-mt-24 border-t border-foreground/10 py-20 sm:py-24">
        <Container className="grid gap-8 lg:grid-cols-12">
          <Reveal className="lg:col-span-4">
            <h2 className="font-heading text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">Carta</h2>
          </Reveal>
          <Reveal className="lg:col-span-8">
            {page.menu === "qr" ? (
              <p className="flex max-w-[56ch] items-start gap-3 leading-relaxed text-foreground/70">
                <QrCode size={20} strokeWidth={2} className="mt-1 shrink-0 text-primary" aria-hidden />
                La carta de {page.name} se revisa en el local: cada mesa tiene un código QR que la abre en el celular.
              </p>
            ) : menus.length > 0 ? (
              <div className="flex flex-wrap gap-3">
                {menus.map((m) => (
                  <a
                    key={m.id}
                    href={m.href}
                    data-pixel-brand={localPixelBrand({ id: m.id, brand: page.catalogBrand }) ?? undefined}
                    {...(m.external ? { target: "_blank", rel: "noreferrer" } : {})}
                    className="inline-flex items-center gap-2 rounded-full bg-foreground/[0.07] px-5 py-3 text-sm font-semibold text-foreground ring-1 ring-foreground/10 transition-colors duration-300 hover:bg-primary hover:text-background"
                  >
                    {m.title}
                    <ArrowUpRight size={15} strokeWidth={2} aria-hidden />
                  </a>
                ))}
              </div>
            ) : (
              <p className="text-foreground/60">
                Revisa todas las cartas del grupo en{" "}
                <a href="/carta" className="font-semibold text-primary hover:text-accent">
                  mandagroup.cl/carta
                </a>
                .
              </p>
            )}
          </Reveal>
        </Container>
      </section>

      {/* Preguntas frecuentes (las mismas que lee Google en el JSON-LD). */}
      <section id="preguntas" className="scroll-mt-24 border-t border-foreground/10 py-20 sm:py-24">
        <Container className="grid gap-12 lg:grid-cols-12">
          <Reveal className="lg:col-span-4">
            <h2 className="max-w-[12ch] font-heading text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              Preguntas frecuentes
            </h2>
          </Reveal>
          <dl className="grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:col-span-8">
            {page.faq.map((f, i) => (
              <Reveal key={f.q} delay={(i % 2) * 80}>
                <dt className="font-heading text-lg font-semibold leading-snug text-foreground">{f.q}</dt>
                <dd className="mt-3 text-sm leading-relaxed text-foreground/65">{f.a}</dd>
              </Reveal>
            ))}
          </dl>
        </Container>
      </section>

      <SiblingLinks current={page.key} siblings={siblings} />
    </>
  );
}

// Resto del grupo: enlaces internos entre marcas (y a la cartelera), para
// que cada página lleve a las demás.
export function SiblingLinks({ current, siblings }: { current?: string; siblings: BrandPage[] }) {
  return (
    <section className="border-t border-foreground/10 py-20 sm:py-24">
      <Container>
        <Reveal>
          <h2 className="font-heading text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">Más de Manda Group</h2>
        </Reveal>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {siblings.map((p, i) => {
            const b = BRANDS.find((x) => x.key === p.key)!;
            return (
              <Reveal key={p.key} delay={i * 80}>
                <a
                  href={brandPagePath(p)}
                  className="group flex h-full items-center gap-4 rounded-2xl bg-foreground/[0.04] p-5 ring-1 ring-foreground/10 transition-colors duration-300 hover:bg-foreground/[0.07]"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- logo local */}
                  <img src={b.logo} alt="" className="h-12 w-12 shrink-0 rounded-full bg-background object-contain p-1" />
                  <span className="min-w-0">
                    <span className="block font-heading font-semibold text-foreground">{p.name}</span>
                    <span className="block text-xs text-foreground/60">{p.eyebrow}</span>
                  </span>
                </a>
              </Reveal>
            );
          })}
          {current !== "fiestas" && (
            <Reveal delay={siblings.length * 80}>
              <a
                href={FIESTAS_PAGE.path}
                className="group flex h-full items-center justify-between gap-4 rounded-2xl bg-primary/10 p-5 ring-1 ring-primary/30 transition-colors duration-300 hover:bg-primary/15"
              >
                <span>
                  <span className="block font-heading font-semibold text-foreground">Fiestas</span>
                  <span className="block text-xs text-foreground/60">Toda la cartelera del grupo</span>
                </span>
                <ArrowUpRight size={18} strokeWidth={2} className="text-primary" aria-hidden />
              </a>
            </Reveal>
          )}
        </div>
      </Container>
    </section>
  );
}
