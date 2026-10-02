import Image from "next/image";
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

// Otras marcas gastronómicas del holding — solo vitrina (logo real + rubro),
// sin dirección ni link: a diferencia de los 2 locales de arriba, estas no
// pasan por el asistente/reservas todavía, así que no se les ofrece una acción.
const OTHER_BRANDS = [
  { name: "Costa Sushi", tag: "Bar & Delivery", logo: "/clients/mandagroup/logo-costa-sushi.png" },
  { name: "Carbon", tag: "Carnes & Parrilla", logo: "/clients/mandagroup/logo-carbon.png" },
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
      {/* Hero — foto real (coctelería de uno de los locales, mandagroup.cl) en
          vez de los blobs de color genéricos: un holding gastronómico se vende
          con su propia ambientación, no con formas abstractas. */}
      <section className="relative overflow-hidden py-28 sm:py-40">
        <Image
          src="/clients/mandagroup/hero-cocktails.jpg"
          alt=""
          fill
          priority
          className="object-cover"
        />
        {/* Scrim oscuro: suficiente contraste para el texto sin perder la foto. */}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-background/40" />
        <div className="absolute inset-0 bg-background/20" />
        <Container className="relative text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-primary">Manda Group</p>
          <h1 className="mx-auto mt-5 max-w-2xl font-heading text-4xl font-bold leading-tight text-foreground sm:text-6xl">
            Gastronomía, música y fiesta bajo un mismo grupo
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

      {/* Más marcas del grupo — vitrina del holding (restaurantes), separada
          de los 2 locales de arriba porque esas sí se reservan por acá; estas
          solo se muestran para transmitir la escala real del grupo. */}
      <section className="relative overflow-hidden py-20 sm:py-28">
        <Image
          src="/clients/mandagroup/costa-sushi.jpg"
          alt=""
          fill
          className="object-cover opacity-[0.07]"
        />
        <Container className="relative">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">El grupo</p>
          <h2 className="mt-3 max-w-xl font-heading text-3xl font-bold text-foreground sm:text-4xl">
            Más marcas de Manda Group
          </h2>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-foreground/60">
            Además de nuestros 2 locales nocturnos, el grupo reúne otras marcas gastronómicas.
          </p>
          <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2">
            {OTHER_BRANDS.map((b) => (
              <div
                key={b.name}
                className="flex items-center gap-5 rounded-2xl border border-foreground/10 bg-foreground/[0.03] p-7"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- mismo patrón que los logos de VENUES arriba */}
                <img src={b.logo} alt={b.name} className="h-14 w-auto max-w-[9rem] object-contain" />
                <div>
                  <h3 className="font-heading text-base font-semibold text-foreground">{b.name}</h3>
                  <p className="mt-0.5 text-sm text-foreground/60">{b.tag}</p>
                </div>
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
