import { clientConfig } from "@/config/client.config";
import { Container } from "@/components/ui/Container";
import { buildWhatsAppLink } from "@/lib/whatsapp";
import { listActiveEvents } from "@/lib/mandagroup-store";

const VENUES = [
  {
    slug: "renaca" as const,
    name: "Manda Reñaca",
    tagline: "Classic Social Lounge",
    address: "Av. Borgoño 14.880, Reñaca",
    logo: "/clients/mandagroup/logo-renaca.png",
    instagram: "https://www.instagram.com/manda.chile/",
  },
  {
    slug: "vina" as const,
    name: "Manda Viña del Mar",
    tagline: "Fiesta, restaurant, música y amigos",
    address: "5 Norte 132, Viña del Mar",
    logo: "/clients/mandagroup/logo-vina.png",
    instagram: "https://www.instagram.com/mandavina.cl/",
  },
];

// Home a medida de Mandagroup: no pasa por components/HomeContent.tsx (hero +
// servicios + about estáticos desde el config) porque acá el contenido central
// — los eventos activos — es dinámico desde la base y se administra en
// /eventos/admin, y el negocio son 2 locales + una marca de fiestas, no
// "servicios". Mismo precedente que /propiedades o /tienda: página bespoke
// que igual reusa Header/Footer/WhatsAppButton/ChatWidget y clientConfig.
export async function MandagroupHome() {
  const { contact } = clientConfig;
  const events = await listActiveEvents();
  const centralWa = contact.whatsapp ? buildWhatsAppLink(contact.whatsapp, contact.whatsappPrefilledMessage) : null;

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-background py-24 sm:py-32">
        <div className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-primary/20 blur-[120px]" />
        <div className="pointer-events-none absolute -bottom-24 left-0 h-72 w-72 rounded-full bg-accent/20 blur-[110px]" />
        <Container className="relative text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-primary">Manda Group</p>
          <h1 className="mx-auto mt-5 max-w-2xl font-heading text-4xl font-bold leading-tight text-foreground sm:text-6xl">
            Dos locales, una misma noche
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-foreground/70 sm:text-lg">
            Manda Reñaca y Manda Viña del Mar — reserva tu mesa o compra tu entrada directo por WhatsApp, sin
            vueltas.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            {centralWa && (
              <a
                href={centralWa}
                className="inline-flex items-center rounded-lg px-7 py-3.5 text-sm font-semibold text-background"
                style={{ background: "linear-gradient(90deg, rgb(var(--color-primary)), rgb(var(--color-accent)))" }}
              >
                Reservar por WhatsApp
              </a>
            )}
            <a
              href="#servicios"
              className="inline-flex items-center rounded-lg border border-foreground/20 px-7 py-3.5 text-sm font-semibold text-foreground hover:border-foreground/40"
            >
              Ver eventos activos
            </a>
          </div>
        </Container>
      </section>

      {/* Locales */}
      <section id="nosotros" className="py-20 sm:py-28">
        <Container>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">Nuestros locales</p>
          <h2 className="mt-3 max-w-xl font-heading text-3xl font-bold text-foreground sm:text-4xl">
            Dónde encontrarnos
          </h2>
          <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2">
            {VENUES.map((v) => (
              <div key={v.slug} className="rounded-2xl border border-foreground/10 bg-foreground/[0.03] p-7">
                {/* eslint-disable-next-line @next/next/no-img-element -- logo real por local, mismo patrón que Header.tsx */}
                <img src={v.logo} alt={v.name} className="h-16 w-16 rounded-full object-cover" />
                <h3 className="mt-5 font-heading text-lg font-semibold text-foreground">{v.name}</h3>
                <p className="mt-1 text-sm text-foreground/60">{v.tagline}</p>
                <p className="mt-3 text-sm text-foreground/70">{v.address}</p>
                <a
                  href={v.instagram}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 inline-block text-sm font-semibold text-primary underline underline-offset-4"
                >
                  Ver Instagram
                </a>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* Eventos activos */}
      <section id="servicios" className="bg-foreground/[0.02] py-20 sm:py-28">
        <Container>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">Costa Nights</p>
          <h2 className="mt-3 max-w-xl font-heading text-3xl font-bold text-foreground sm:text-4xl">
            Eventos activos
          </h2>
          {events.length === 0 ? (
            <p className="mt-8 text-foreground/60">
              No hay eventos publicados por ahora — escríbenos por WhatsApp y te contamos qué viene.
            </p>
          ) : (
            <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {events.map((e) => (
                <div key={e.id} className="rounded-2xl border border-foreground/10 bg-background p-6">
                  <p className="text-xs font-semibold uppercase tracking-wider text-accent">
                    {e.venue === "renaca" ? "Manda Reñaca" : "Manda Viña del Mar"}
                  </p>
                  <h3 className="mt-2 font-heading text-lg font-semibold text-foreground">{e.title}</h3>
                  <p className="mt-1 text-sm capitalize text-foreground/60">
                    {new Date(e.eventDate + "T12:00:00").toLocaleDateString("es-CL", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                    })}
                  </p>
                  <a
                    href={e.ticketUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-5 inline-flex items-center rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-background hover:opacity-90"
                  >
                    Comprar entrada
                  </a>
                </div>
              ))}
            </div>
          )}
        </Container>
      </section>

      {/* Contacto */}
      <section id="contacto" className="py-20 sm:py-28">
        <Container className="text-center">
          <h2 className="font-heading text-3xl font-bold text-foreground sm:text-4xl">Hablemos</h2>
          <p className="mx-auto mt-4 max-w-md text-foreground/70">
            Reservas, entradas o cualquier consulta — respondemos por WhatsApp, Instagram o el chat de esta página.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            {centralWa && (
              <a href={centralWa} className="rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-background">
                WhatsApp Manda Group
              </a>
            )}
            {VENUES.map((v) => (
              <a
                key={v.slug}
                href={v.instagram}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg border border-foreground/20 px-6 py-3 text-sm font-semibold text-foreground"
              >
                Instagram {v.name}
              </a>
            ))}
          </div>
        </Container>
      </section>
    </>
  );
}
