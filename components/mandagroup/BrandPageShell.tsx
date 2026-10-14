import type { Metadata } from "next";
import { clientConfig } from "@/config/client.config";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { WhatsAppButton } from "@/components/layout/WhatsAppButton";
import { BrandLanding } from "@/components/mandagroup/BrandLanding";
import { BRANDS } from "@/lib/mandagroup-brands";
import { brandPagePath, type BrandPage } from "@/lib/mandagroup-pages";

export function brandMetadata(page: BrandPage): Metadata {
  const path = brandPagePath(page);
  const brand = BRANDS.find((b) => b.key === page.key)!;
  const image = brand.fallbackImage ?? clientConfig.seo.ogImageUrl;
  return {
    // absolute: el título ya trae la marca; sin el sufijo "| Manda Group".
    title: { absolute: page.title },
    description: page.description,
    alternates: { canonical: path },
    openGraph: {
      title: page.title,
      description: page.description,
      url: path,
      type: "website",
      locale: "es_CL",
      siteName: "Manda Group",
      ...(image ? { images: [{ url: image }] } : {}),
    },
  };
}

// Header/Footer del sitio + el botón de WhatsApp de consultas, igual que la home.
export function BrandPageShell({ page }: { page: BrandPage }) {
  const { contact, modules } = clientConfig;
  return (
    <>
      <Header config={clientConfig} />
      <main>
        <BrandLanding page={page} />
      </main>
      <Footer config={clientConfig} />
      {modules.whatsappButton && contact.whatsapp ? (
        <WhatsAppButton phone={contact.whatsapp} message={contact.whatsappPrefilledMessage} />
      ) : null}
    </>
  );
}
