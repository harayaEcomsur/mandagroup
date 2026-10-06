import Image from "next/image";
import { ArrowUpRight, MapPin } from "lucide-react";
import { clientConfig } from "@/config/client.config";
import { Container } from "@/components/ui/Container";
import { Reveal } from "@/components/mandagroup/Reveal";
import { buildWhatsAppLink } from "@/lib/whatsapp";
import { listActiveEvents, type MandagroupEvent } from "@/lib/mandagroup-store";
import { getAccountMedia, type InstagramMedia } from "@/lib/instagram";
import { vestiCompanyUrl } from "@/lib/vesti";
import { BRANDS, SITE_FAQ, eventVenueLabel, type Brand } from "@/lib/mandagroup-brands";
import { buildMandagroupJsonLd } from "@/lib/mandagroup-seo";
import { pickHero, splitEvents } from "@/lib/mandagroup-hero";





const TZ = "America/Santiago";

function dateParts(e: MandagroupEvent) {
  const d = new Date(e.eventDate + "T12:00:00");
  return {
    day: d.toLocaleDateString("es-CL", { day: "numeric" }),
    weekday: d.toLocaleDateString("es-CL", { weekday: "short" }).replace(".", ""),
    month: d.toLocaleDateString("es-CL", { month: "short" }).replace(".", ""),
    long: d.toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long" }),
  };
}

function startTime(e: MandagroupEvent): string | null {
  if (!e.startsAt) return null;
  return new Date(e.startsAt).toLocaleTimeString("es-CL", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
}

// "2026-10-31" → "31 de octubre" (eventos de varios días, ej. Cyber Days).
function untilDate(ymd: string): string {
  return new Date(ymd + "T12:00:00").toLocaleDateString("es-CL", { day: "numeric", month: "long" });
}

function clp(n: number): string {
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(n);
}

// Home a medida de Manda Group: no pasa por components/HomeContent.tsx porque
// el contenido central es dinámico (cartelera desde Vesti + cargada a mano en
// /eventos/admin, feed de Instagram de cada marca). Reusa Header/Footer/
// WhatsAppButton/ChatWidget y clientConfig como cualquier otro cliente.
export async function MandagroupHome() {
  const { contact } = clientConfig;
  const [events, feeds] = await Promise.all([
    listActiveEvents(),
    Promise.all(BRANDS.map((b) => getAccountMedia(process.env[b.tokenEnv], 6))),
  ]);
  const centralWa = contact.whatsapp ? buildWhatsAppLink(contact.whatsapp, contact.whatsappPrefilledMessage) : null;

  // Sin feed de Instagram, un club cae al flyer de su próxima fecha (imagen
  // real y actual) antes que a la foto fija o al logo.
  const brandImage = (i: number): string | null => {
    const b = BRANDS[i];
    const flyer = events.find((e) => e.venue === b.key && e.imageUrl)?.imageUrl ?? null;
    return feeds[i]?.[0]?.mediaUrl ?? (b.key === "vina" ? flyer : null) ?? b.fallbackImage ?? flyer;
  };
  // Hero: destacados a mano, o la próxima noche (hasta 2 eventos, en orden de
  // prioridad). Promociones de varios días: sección propia. Cartelera: solo
  // noches de fiesta. Ver lib/mandagroup-hero.ts.
  const hero = pickHero(events);
  const { nights, promos } = splitEvents(events);
  const heroSameDate = hero ? hero.events.every((e) => e.eventDate === hero.events[0].eventDate) : false;
  const posts = feeds
    .flatMap((media, i) => (media ?? []).map((m) => ({ ...m, handle: BRANDS[i].handle })))
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, 8);

  const jsonLd = buildMandagroupJsonLd(events);

  return (
    <>
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      {/* Hero: foto real a sangre, texto a la izquierda y la próxima fiesta
          (flyer real de Vesti) a la derecha — lo primero que se ve es que
          hay algo pasando esta semana, no un eslogan. */}
      <section className="relative isolate overflow-hidden">
        <Image
          src="/clients/mandagroup/hero-cocktails.jpg"
          alt="Coctelería en uno de los locales de Manda Group"
          fill
          priority
          sizes="100vw"
          // Va bajo un degradado oscuro casi opaco a la izquierda: calidad 55
          // no se nota y baja bastante el peso del LCP.
          quality={55}
          className="-z-10 object-cover"
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-background via-background/85 to-background/30" />
        <div className="absolute inset-x-0 bottom-0 -z-10 h-40 bg-gradient-to-t from-background to-transparent" />
        <Container className="grid min-h-[78dvh] items-center gap-12 py-20 lg:grid-cols-12 lg:py-24">
          <Reveal mode="load" className="lg:col-span-8">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">Manda Group</p>
            <h1 className="mt-5 max-w-[26ch] text-balance font-heading text-5xl font-semibold leading-[1.04] tracking-tight text-foreground sm:text-6xl lg:text-[3.6rem]">
              Comer, brindar y bailar en la costa de Valparaíso.
            </h1>
            <p className="mt-6 max-w-[48ch] text-lg leading-relaxed text-foreground/70">
              Clubes en Reñaca y Viña del Mar, las fiestas Costa Nights, Costa Sushi en Valparaíso y Curauma, y
              Carbon.
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-4">
              <a
                href="#eventos"
                className="group inline-flex items-center gap-3 rounded-full bg-primary py-2 pl-6 pr-2 text-sm font-semibold text-background transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 active:scale-[0.98]"
              >
                Ver cartelera
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-background/15 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5">
                  <ArrowUpRight size={16} strokeWidth={2} />
                </span>
              </a>
              {centralWa && (
                <a
                  href={centralWa}
                  className="text-sm font-semibold text-foreground underline decoration-foreground/30 underline-offset-8 transition-colors hover:decoration-primary"
                >
                  Reservar mesa por WhatsApp
                </a>
              )}
            </div>
          </Reveal>

          {hero && (
            <Reveal mode="load" delay={150} className="w-full max-w-sm lg:col-span-4 lg:col-start-9 lg:max-w-none lg:pl-4">
              <div className="rounded-[1.75rem] bg-foreground/[0.06] p-2 ring-1 ring-foreground/10 backdrop-blur-sm">
                <div className={`grid gap-2 ${hero.events.length > 1 ? "grid-cols-2" : ""}`}>
                  {hero.events.map((e) => (
                    <a
                      key={e.id}
                      href={e.ticketUrl}
                      data-pixel-event={e.title}
                      target="_blank"
                      rel="noreferrer"
                      className="group relative block aspect-[4/5] overflow-hidden rounded-[1.25rem] transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-1"
                    >
                      <Image
                        src={e.imageUrl!}
                        alt={`Flyer de ${e.title}`}
                        fill
                        // Sin lazy (en escritorio está a la vista de entrada), pero
                        // sin prioridad alta: en celular queda bajo el pliegue y no
                        // debe competir con la foto del hero (el LCP).
                        loading="eager"
                        sizes={hero.events.length > 1 ? "(min-width: 1024px) 15vw, 45vw" : "(min-width: 1024px) 30vw, 90vw"}
                        className="object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                      />
                    </a>
                  ))}
                </div>
                <div className="flex items-center justify-between gap-4 px-3 pb-2 pt-4">
                  <div className="min-w-0">
                    <p className="truncate text-xs text-foreground/60">
                      {hero.featured ? "Destacado" : "Próxima fecha"} ·{" "}
                      {hero.events.length > 1 ? `${hero.events.length + hero.extra} eventos` : eventVenueLabel(hero.events[0])}
                    </p>
                    <p className="mt-1 truncate font-heading text-base font-semibold text-foreground first-letter:uppercase">
                      {hero.events.length === 1 && hero.events[0].lastDate && hero.events[0].lastDate !== hero.events[0].eventDate
                        ? `Hasta el ${untilDate(hero.events[0].lastDate)}`
                        : heroSameDate
                          ? dateParts(hero.events[0]).long
                          : "Próximas fechas"}
                    </p>
                  </div>
                  {hero.events.length === 1 ? (
                    <a
                      href={hero.events[0].ticketUrl}
                      data-pixel-event={hero.events[0].title}
                      target="_blank"
                      rel="noreferrer"
                      className="shrink-0 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-background transition-transform active:scale-[0.98]"
                    >
                      Entradas
                    </a>
                  ) : (
                    <a
                      href="#eventos"
                      className="shrink-0 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-background transition-transform active:scale-[0.98]"
                    >
                      {hero.extra ? `+${hero.extra} más` : "Ver fechas"}
                    </a>
                  )}
                </div>
              </div>
            </Reveal>
          )}
        </Container>
      </section>

      {/* Promociones: ocasiones de varios días (Cyber Days, gift cards…). No son
          una noche de fiesta, pero merecen vitrina propia, separada de la
          cartelera. Solo aparece si hay alguna vigente. */}
      {promos.length > 0 && (
        <section id="promociones" className="scroll-mt-24 pt-24 sm:pt-32">
          <Container>
            <Reveal>
              <h2 className="font-heading text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
                Promociones
              </h2>
            </Reveal>
            <div className="mt-10 grid gap-4 md:grid-cols-2">
              {promos.map((p) => (
                <Reveal key={p.id} as="article">
                  <a
                    href={p.ticketUrl}
                    data-pixel-event={p.title}
                    target="_blank"
                    rel="noreferrer"
                    className="group flex gap-5 rounded-2xl bg-foreground/[0.04] p-3 ring-1 ring-foreground/10 transition-colors duration-300 hover:bg-foreground/[0.07]"
                  >
                    {p.imageUrl && (
                      <div className="relative aspect-[4/5] w-28 shrink-0 overflow-hidden rounded-xl sm:w-36">
                        <Image
                          src={p.imageUrl}
                          alt={`Flyer de ${p.title}`}
                          fill
                          sizes="9rem"
                          className="object-cover transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.04]"
                        />
                      </div>
                    )}
                    <div className="flex min-w-0 flex-1 flex-col py-1 pr-2">
                      <p className="text-xs text-primary">{eventVenueLabel(p)}</p>
                      <h3 className="mt-1 line-clamp-3 font-heading text-base font-semibold leading-snug text-foreground">
                        {p.title}
                      </h3>
                      <p className="mt-2 text-xs text-foreground/50">
                        {[
                          p.lastDate ? `Hasta el ${untilDate(p.lastDate)}` : null,
                          p.lowestPrice ? `Desde ${clp(p.lowestPrice)}` : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                      <span className="mt-auto inline-flex items-center gap-2 pt-4 text-sm font-semibold text-foreground group-hover:text-primary">
                        Ver promoción
                        <ArrowUpRight size={15} strokeWidth={2} />
                      </span>
                    </div>
                  </a>
                </Reveal>
              ))}
            </div>
          </Container>
        </section>
      )}

      {/* Cartelera: riel horizontal de flyers (todo lo que está a la venta en
          Vesti + lo cargado a mano), cada uno con su link de compra. */}
      <section id="eventos" className="scroll-mt-24 py-24 sm:py-32">
        {/* Ancla heredada: links viejos a /#servicios siguen llegando acá. */}
        <span id="servicios" className="block scroll-mt-24" aria-hidden />
        <Container>
          <Reveal className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <h2 className="font-heading text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
                Próximas fiestas
              </h2>
              <p className="mt-3 max-w-[52ch] text-foreground/60">
                Manda Reñaca, Manda Viña del Mar, las fiestas Costa Nights y los shows de Eventos &amp; Stand Up. Las
                entradas se compran en Vesti.
              </p>
            </div>
            <div className="flex gap-5 text-sm font-semibold">
              <a href={vestiCompanyUrl("renaca")} target="_blank" rel="noreferrer" className="text-foreground/70 hover:text-primary">
                Vesti Reñaca
              </a>
              <a href={vestiCompanyUrl("vina")} target="_blank" rel="noreferrer" className="text-foreground/70 hover:text-primary">
                Vesti Viña
              </a>
              <a href={vestiCompanyUrl("costa")} target="_blank" rel="noreferrer" className="text-foreground/70 hover:text-primary">
                Vesti Costa Nights
              </a>
              <a href={vestiCompanyUrl("standup")} target="_blank" rel="noreferrer" className="text-foreground/70 hover:text-primary">
                Vesti Stand Up
              </a>
            </div>
          </Reveal>
        </Container>

        {nights.length === 0 ? (
          <Container>
            <div className="mt-12 rounded-2xl bg-foreground/[0.04] p-10 ring-1 ring-foreground/10">
              <p className="font-heading text-xl font-semibold text-foreground">No hay fechas a la venta ahora mismo.</p>
              <p className="mt-2 text-foreground/60">
                Escríbenos por WhatsApp o Instagram y te contamos qué viene.
              </p>
            </div>
          </Container>
        ) : (
          // La animación va en el riel completo y no en cada tarjeta: dentro
          // de un contenedor con scroll horizontal, view() mediría ese scroll
          // y no el de la página.
          <Reveal className="rail mt-12 flex snap-x snap-mandatory scroll-px-4 gap-5 overflow-x-auto px-4 pb-4 sm:scroll-px-6 sm:px-6 lg:scroll-px-[max(2rem,calc((100vw_-_72rem)/2_+_2rem))] lg:px-[max(2rem,calc((100vw_-_72rem)/2_+_2rem))]">
            {nights.map((e) => {
              const d = dateParts(e);
              const time = startTime(e);
              return (
                <article
                  key={e.id}
                  className="group flex w-[78vw] max-w-[19rem] shrink-0 snap-start flex-col sm:w-[19rem]"
                >
                  <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-foreground/[0.05] ring-1 ring-foreground/10">
                    {e.imageUrl ? (
                      <Image
                        src={e.imageUrl}
                        alt={`Flyer de ${e.title}`}
                        fill
                        sizes="19rem"
                        className="object-cover transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.04]"
                      />
                    ) : (
                      <div className="flex h-full flex-col justify-end bg-gradient-to-br from-primary/25 via-background to-background p-6">
                        <p className="font-heading text-2xl font-semibold leading-tight text-foreground">{e.title}</p>
                      </div>
                    )}
                  </div>
                  <div className="mt-4 flex gap-4">
                    <div className="w-12 shrink-0 text-center">
                      <p className="font-heading text-3xl font-semibold leading-none tabular-nums text-foreground">{d.day}</p>
                      <p className="mt-1 text-xs capitalize text-foreground/60">
                        {d.weekday} {d.month}
                      </p>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-primary">{eventVenueLabel(e)}</p>
                      <h3 className="mt-1 line-clamp-2 font-heading text-base font-semibold leading-snug text-foreground">
                        {e.title}
                      </h3>
                      <p className="mt-1 text-xs text-foreground/50">
                        {[
                          e.lastDate && e.lastDate !== e.eventDate ? `Hasta el ${untilDate(e.lastDate)}` : time && `${time} h`,
                          e.soldOut ? "Agotado" : e.lowestPrice ? `Desde ${clp(e.lowestPrice)}` : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                  </div>
                  <a
                    href={e.ticketUrl}
                    data-pixel-event={e.title}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-5 inline-flex items-center justify-center gap-2 rounded-full bg-foreground/[0.07] px-5 py-3 text-sm font-semibold text-foreground ring-1 ring-foreground/10 transition-colors duration-300 hover:bg-primary hover:text-background active:scale-[0.98]"
                  >
                    {e.soldOut ? "Ver en Vesti" : "Comprar entrada"}
                    <ArrowUpRight size={15} strokeWidth={2} />
                  </a>
                </article>
              );
            })}
          </Reveal>
        )}
      </section>

      {/* Marcas: bento de 4 (los 2 clubes más grandes, los 2 restaurantes
          abajo), cada uno con la última foto real de su Instagram. */}
      <section id="marcas" className="scroll-mt-24 pb-24 sm:pb-32">
        <span id="nosotros" className="block scroll-mt-24" aria-hidden />
        <Container>
          <Reveal>
            <h2 className="max-w-[18ch] font-heading text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
              Cuatro marcas, una misma forma de recibir.
            </h2>
          </Reveal>
          <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-12 md:grid-rows-[20rem_14rem]">
            {BRANDS.map((b, i) => (
              <BrandTile
                key={b.key}
                brand={b}
                image={brandImage(i)}
                delay={i * 80}
                className={
                  i === 0
                    ? "md:col-span-7"
                    : i === 1
                      ? "md:col-span-5"
                      : i === 2
                        ? "md:col-span-6"
                        : "md:col-span-6"
                }
              />
            ))}
          </div>
        </Container>
      </section>

      {/* Instagram: lo último publicado por las 4 cuentas, mezclado por fecha. */}
      <section id="instagram" className="scroll-mt-24 border-t border-foreground/10 py-24 sm:py-32">
        <Container>
          <Reveal className="flex flex-wrap items-end justify-between gap-6">
            <h2 className="font-heading text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
              En Instagram
            </h2>
            <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold">
              {BRANDS.map((b) => (
                <a
                  key={b.handle}
                  href={`https://www.instagram.com/${b.handle}/`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-foreground/70 hover:text-primary"
                >
                  @{b.handle}
                </a>
              ))}
            </div>
          </Reveal>

          {posts.length > 0 ? (
            <div className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {posts.map((p, i) => (
                <InstagramTile key={p.id} post={p} delay={(i % 4) * 60} />
              ))}
            </div>
          ) : (
            <div className="mt-12 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {BRANDS.map((b) => (
                <a
                  key={b.handle}
                  href={`https://www.instagram.com/${b.handle}/`}
                  target="_blank"
                  rel="noreferrer"
                  className="group flex items-center gap-4 rounded-2xl bg-foreground/[0.04] p-5 ring-1 ring-foreground/10 transition-colors hover:bg-foreground/[0.07]"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- logo local de cada marca */}
                  <img src={b.logo} alt="" className="h-12 w-12 rounded-full bg-background object-contain p-1" />
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-foreground">@{b.handle}</p>
                    <p className="text-sm text-foreground/60">{b.name}</p>
                  </div>
                  <ArrowUpRight size={18} className="ml-auto shrink-0 text-foreground/40 group-hover:text-primary" />
                </a>
              ))}
            </div>
          )}
        </Container>
      </section>

      {/* Preguntas frecuentes: respuestas cortas y autocontenidas (las
          mismas del FAQPage en el JSON-LD), lo que más preguntan por DM. */}
      <section id="preguntas" className="scroll-mt-24 border-t border-foreground/10 py-24 sm:py-32">
        <Container className="grid gap-12 lg:grid-cols-12">
          <Reveal className="lg:col-span-4">
            <h2 className="max-w-[12ch] font-heading text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
              Preguntas frecuentes
            </h2>
          </Reveal>
          <dl className="grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:col-span-8">
            {SITE_FAQ.map((f, i) => (
              <Reveal key={f.q} delay={(i % 2) * 80}>
                <dt className="font-heading text-lg font-semibold leading-snug text-foreground">{f.q}</dt>
                <dd className="mt-3 text-sm leading-relaxed text-foreground/65">{f.a}</dd>
              </Reveal>
            ))}
          </dl>
        </Container>
      </section>

      {/* Contacto: una sola vía clara (WhatsApp) + dónde están los clubes. */}
      <section id="contacto" className="scroll-mt-24 border-t border-foreground/10 py-24 sm:py-32">
        <Container className="grid gap-14 lg:grid-cols-12">
          <Reveal className="lg:col-span-6">
            <h2 className="max-w-[16ch] font-heading text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
              Reservas, listas y eventos privados.
            </h2>
            <p className="mt-5 max-w-[46ch] text-foreground/60">
              Te respondemos por WhatsApp, por Instagram o en el chat de esta página.
            </p>
            {centralWa && (
              <a
                href={centralWa}
                className="group mt-10 inline-flex items-center gap-3 rounded-full bg-primary py-2 pl-6 pr-2 text-sm font-semibold text-background transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 active:scale-[0.98]"
              >
                Escribir por WhatsApp
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-background/15 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5">
                  <ArrowUpRight size={16} strokeWidth={2} />
                </span>
              </a>
            )}
          </Reveal>
          <div className="grid content-start items-start gap-4 sm:grid-cols-2 lg:col-span-6">
            {BRANDS.filter((b) => b.address).map((b, i) => (
              <Reveal key={b.key} delay={i * 80} className="rounded-2xl bg-foreground/[0.04] p-6 ring-1 ring-foreground/10">
                <p className="font-heading text-lg font-semibold text-foreground">{b.name}</p>
                <p className="mt-1 text-sm text-foreground/60">{b.address}</p>
                {b.maps && (
                  <a
                    href={b.maps}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-primary hover:text-accent"
                  >
                    <MapPin size={15} strokeWidth={2} />
                    Cómo llegar
                  </a>
                )}
              </Reveal>
            ))}
          </div>
        </Container>
      </section>
    </>
  );
}

function BrandTile({
  brand,
  image,
  className,
  delay,
}: {
  brand: Brand;
  image: string | null;
  className: string;
  delay: number;
}) {
  return (
    <Reveal delay={delay} className={`group relative min-h-[16rem] overflow-hidden rounded-2xl ring-1 ring-foreground/10 ${className}`}>
      <a href={`https://www.instagram.com/${brand.handle}/`} target="_blank" rel="noreferrer" className="absolute inset-0 block">
        {image ? (
          <Image
            src={image}
            alt={`${brand.name} en Instagram`}
            fill
            sizes="(min-width: 768px) 50vw, 100vw"
            className="object-cover transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.04]"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-foreground/[0.08] via-background to-primary/10">
            {/* eslint-disable-next-line @next/next/no-img-element -- logo local, protagonista mientras no haya foto */}
            <img
              src={brand.logo}
              alt=""
              className="h-28 w-28 object-contain opacity-80 transition-transform duration-700 group-hover:scale-[1.04]"
            />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/55 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 flex items-end gap-4 p-6">
          {/* eslint-disable-next-line @next/next/no-img-element -- logo local de la marca */}
          <img src={brand.logo} alt="" className="h-14 w-14 shrink-0 rounded-full bg-background/80 object-contain p-1" />
          <div className="min-w-0 flex-1">
            <h3 className="font-heading text-xl font-semibold text-foreground">{brand.name}</h3>
            <p className="text-sm text-foreground/70">{brand.kind}</p>
          </div>
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-foreground/10 text-foreground transition-colors duration-300 group-hover:bg-primary group-hover:text-background">
            <ArrowUpRight size={18} strokeWidth={2} />
          </span>
        </div>
      </a>
    </Reveal>
  );
}

function InstagramTile({ post, delay }: { post: InstagramMedia & { handle: string }; delay: number }) {
  return (
    <Reveal delay={delay}>
      <a
        href={post.permalink}
        target="_blank"
        rel="noreferrer"
        className="group relative block aspect-square overflow-hidden rounded-2xl bg-foreground/[0.05] ring-1 ring-foreground/10"
      >
        <Image
          src={post.mediaUrl}
          alt={post.caption ? post.caption.slice(0, 120) : `Publicación de @${post.handle}`}
          fill
          sizes="(min-width: 640px) 25vw, 50vw"
          className="object-cover transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.04]"
        />
      </a>
      <p className="mt-2 truncate text-xs text-foreground/50">@{post.handle}</p>
    </Reveal>
  );
}
