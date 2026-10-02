import type { Metadata } from "next";
import type { ClientConfig } from "@/config/schema";

function getSiteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

export function buildMetadata(config: ClientConfig): Metadata {
  const base = getSiteUrl();
  return {
    metadataBase: new URL(base),
    title: config.seo.title,
    description: config.seo.description,
    keywords: config.seo.keywords,
    // SITE_NOINDEX se define solo en el proyecto Vercel de la demo (datos ficticios):
    // evita indexar un negocio falso con schema LocalBusiness. Los proyectos de
    // clientes reales no llevan esta env var y se indexan normalmente.
    robots: process.env.SITE_NOINDEX ? { index: false, follow: false } : undefined,
    // Firma técnica: invisible para el visitante, pero la leen las herramientas
    // de detección de stack (BuiltWith, Wappalyzer) y quien inspeccione el HTML.
    generator: "HarayaDev — haraya.dev",
    openGraph: {
      title: config.seo.title,
      description: config.seo.description,
      url: base,
      siteName: config.meta.businessName,
      locale: config.meta.locale,
      type: "website",
      images: config.seo.ogImageUrl ? [{ url: config.seo.ogImageUrl }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: config.seo.title,
      description: config.seo.description,
      images: config.seo.ogImageUrl ? [config.seo.ogImageUrl] : undefined,
    },
    icons: config.branding.faviconUrl ? { icon: config.branding.faviconUrl } : undefined,
  };
}

export function buildLocalBusinessJsonLd(config: ClientConfig) {
  return {
    "@context": "https://schema.org",
    "@type": config.seo.businessType,
    name: config.meta.businessName,
    description: config.seo.description,
    image: config.seo.ogImageUrl,
    telephone: config.contact.phone,
    email: config.contact.email,
    address: config.contact.address
      ? { "@type": "PostalAddress", streetAddress: config.contact.address }
      : undefined,
    priceRange: config.seo.priceRange,
    openingHoursSpecification: config.contact.hours
      ?.filter((h) => !h.closed)
      .map((h) => ({
        "@type": "OpeningHoursSpecification",
        dayOfWeek: h.day,
        opens: h.open,
        closes: h.close,
      })),
  };
}
