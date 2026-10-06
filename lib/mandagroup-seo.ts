import { clientConfig } from "@/config/client.config";
import type { MandagroupEvent } from "@/lib/mandagroup-store";
import { BRANDS, SITE_FAQ, VENUE_LOCALITY, EVENT_VENUE_LABEL, eventVenueLabel } from "@/lib/mandagroup-brands";

// JSON-LD de la home de Manda Group, en un solo @graph:
// - Organization (el holding) con sus marcas y cuentas oficiales (sameAs)
// - NightClub por cada local, con dirección real
// - Restaurant por Costa Sushi y Carbon
// - Event por cada fecha a la venta (Google muestra eventos enriquecidos y
//   los asistentes de IA responden "qué fiestas hay en Viña este finde")
// - FAQPage con las mismas preguntas que se ven en la página
// Reemplaza al LocalBusiness genérico del layout (ver seo.jsonLdInPage).

function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

export function buildMandagroupJsonLd(events: MandagroupEvent[]) {
  const base = siteUrl();
  const orgId = `${base}/#organization`;
  const venueId = (key: string) => `${base}/#${key}`;

  const brands = BRANDS.map((b) => {
    const isClub = b.key === "renaca" || b.key === "vina";
    return {
      "@type": isClub ? "NightClub" : "Restaurant",
      "@id": venueId(b.key),
      name: b.name,
      description: b.kind,
      logo: `${base}${b.logo}`,
      image: `${base}${b.fallbackImage ?? b.logo}`,
      sameAs: [`https://www.instagram.com/${b.handle}/`],
      parentOrganization: { "@id": orgId },
      ...(isClub && b.address
        ? {
            address: {
              "@type": "PostalAddress",
              streetAddress: b.address.split(",")[0],
              addressLocality: VENUE_LOCALITY[b.key as "renaca" | "vina"],
              addressRegion: "Valparaíso",
              addressCountry: "CL",
            },
            hasMap: b.maps,
          }
        : {}),
      ...(b.key === "costa"
        ? { servesCuisine: "Sushi", areaServed: ["Valparaíso", "Curauma"] }
        : b.key === "carbon"
          ? { servesCuisine: "Parrilla" }
          : {}),
    };
  });

  const eventNodes = events.map((e) => {
    const venue = e.venue === "renaca" || e.venue === "vina" ? BRANDS.find((b) => b.key === e.venue)! : null;
    const where = eventVenueLabel(e);
    // Dirección: la real que publica Vesti para el evento (con coordenadas);
    // si no viene, la del local; las de Costa Nights sin dato quedan a nivel
    // de región.
    const streetAddress = e.address?.split(",")[0] ?? venue?.address?.split(",")[0];
    const locality = e.comuna ?? (venue ? VENUE_LOCALITY[venue.key as "renaca" | "vina"] : undefined);
    const availability = (soldOut?: boolean) =>
      soldOut ? "https://schema.org/SoldOut" : "https://schema.org/InStock";
    return {
      "@type": "Event",
      name: e.title,
      startDate: e.startsAt ?? e.eventDate,
      ...(e.endsAt ? { endDate: e.endsAt } : {}),
      eventStatus: e.rescheduled ? "https://schema.org/EventRescheduled" : "https://schema.org/EventScheduled",
      eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
      image: e.imageUrl ? [e.imageUrl] : [`${base}/clients/mandagroup/og-manda.jpg`],
      description: `${e.title} en ${where}. Entradas a la venta en Vesti.`,
      location: {
        "@type": "Place",
        name: e.place ?? (venue ? venue.name : EVENT_VENUE_LABEL[e.venue]),
        address: {
          "@type": "PostalAddress",
          ...(streetAddress ? { streetAddress } : {}),
          ...(locality ? { addressLocality: locality } : {}),
          addressRegion: "Valparaíso",
          addressCountry: "CL",
        },
        ...(e.geo ? { geo: { "@type": "GeoCoordinates", latitude: e.geo.lat, longitude: e.geo.lng } } : {}),
      },
      organizer: { "@type": "Organization", name: venue ? venue.name : EVENT_VENUE_LABEL[e.venue], url: base },
      // Un Offer por tipo de entrada (cortesía, early bird, general…) con su
      // precio y si está agotada, tal como los publica Vesti.
      offers: e.tickets?.length
        ? e.tickets.map((t) => ({
            "@type": "Offer",
            name: t.name,
            url: e.ticketUrl,
            price: t.price,
            priceCurrency: "CLP",
            availability: availability(t.soldOut),
          }))
        : {
            "@type": "Offer",
            url: e.ticketUrl,
            availability: availability(e.soldOut),
            ...(e.lowestPrice ? { price: e.lowestPrice, priceCurrency: "CLP" } : {}),
          },
    };
  });

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": orgId,
        name: "Manda Group",
        url: base,
        logo: `${base}${clientConfig.branding.logoUrl}`,
        description: clientConfig.seo.description,
        sameAs: BRANDS.map((b) => `https://www.instagram.com/${b.handle}/`),
        subOrganization: BRANDS.map((b) => ({ "@id": venueId(b.key) })),
        ...(clientConfig.contact.whatsapp
          ? {
              contactPoint: {
                "@type": "ContactPoint",
                contactType: "reservations",
                telephone: `+${clientConfig.contact.whatsapp}`,
                availableLanguage: "es",
              },
            }
          : {}),
      },
      { "@type": "WebSite", "@id": `${base}/#website`, url: base, name: "Manda Group", inLanguage: "es-CL", publisher: { "@id": orgId } },
      ...brands,
      ...eventNodes,
      {
        "@type": "FAQPage",
        mainEntity: SITE_FAQ.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      },
    ],
  };
}
