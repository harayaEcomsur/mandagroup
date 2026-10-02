import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { clientConfig } from "@/config/client.config";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { WhatsAppButton } from "@/components/layout/WhatsAppButton";
import { ChatWidget } from "@/components/chat/ChatWidget";
import { PropertyExplorer } from "@/components/properties/PropertyExplorer";

export const metadata: Metadata = {
  title: `Propiedades — ${clientConfig.meta.businessName}`,
  description: `Propiedades en venta y arriendo de ${clientConfig.meta.businessName}. Busca por comuna, tipo y dormitorios.`,
};

export default function PropiedadesPage() {
  const { modules, properties, contact, syndication } = clientConfig;
  if (!modules.propiedades || !properties?.length) notFound();
  const hasWhatsapp = modules.whatsappButton && Boolean(contact.whatsapp);
  const portals = [
    syndication?.portalinmobiliario && "Portalinmobiliario",
    syndication?.instagram && "Instagram",
    syndication?.tiktok && "TikTok",
  ].filter(Boolean);

  return (
    <>
      <Header config={clientConfig} />
      <main className="py-14 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">Propiedades</p>
          <h1 className="mt-3 font-heading text-3xl font-bold text-foreground sm:text-4xl">
            Encuentra tu próxima propiedad
          </h1>
          {portals.length > 0 && (
            <p className="mt-3 max-w-2xl text-sm text-foreground/60">
              Cada propiedad se publica también en {portals.join(" y ")} — un solo lugar para
              administrar, todos los canales al día.
            </p>
          )}
          <div className="mt-10">
            <PropertyExplorer properties={properties} />
          </div>
        </div>
      </main>
      <Footer config={clientConfig} />
      {hasWhatsapp && contact.whatsapp ? (
        <WhatsAppButton phone={contact.whatsapp} message={contact.whatsappPrefilledMessage} />
      ) : null}
      {modules.chat ? <ChatWidget businessName={clientConfig.meta.businessName} stacked={hasWhatsapp} /> : null}
    </>
  );
}
