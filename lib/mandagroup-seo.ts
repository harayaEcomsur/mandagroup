import { clientConfig } from "@/config/client.config";
import type { MandagroupEvent } from "@/lib/mandagroup-store";
import { BRANDS, SITE_FAQ, VENUE_LOCALITY } from "@/lib/mandagroup-brands";

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
    const venue = BRANDS.find((b) => b.key === e.venue)!;
    return {
      "@type": "Event",
      name: e.title,
      startDate: e.startsAt ?? e.eventDate,
      eventStatus: "https://schema.org/EventScheduled",
      eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
      image: e.imageUrl ? [e.imageUrl] : [`${base}/clients/mandagroup/og-manda.jpg`],
      description: `${e.title} en ${venue.name}. Entradas a la venta en Vesti.`,
      location: {
        "@type": "Place",
        name: venue.name,
        address: {
          "@type": "PostalAddress",
          streetAddress: venue.address?.split(",")[0],
          addressLocality: VENUE_LOCALITY[e.venue],
          addressRegion: "Valparaíso",
          addressCountry: "CL",
        },
      },
      organizer: { "@type": "Organization", name: venue.name, url: base },
      offers: {
        "@type": "Offer",
        url: e.ticketUrl,
        availability: "https://schema.org/InStock",
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
