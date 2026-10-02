import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BedDouble, Bath, Ruler, Car, ArrowLeft } from "lucide-react";
import { clientConfig } from "@/config/client.config";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { WhatsAppButton } from "@/components/layout/WhatsAppButton";
import { ChatWidget } from "@/components/chat/ChatWidget";
import { OPERATION_LABEL } from "@/components/properties/PropertyCard";
import { buildWhatsAppLink } from "@/lib/whatsapp";

// Convierte URLs de YouTube (watch / youtu.be / shorts) a URL de embed.
function toYouTubeEmbed(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([\w-]{6,})/);
  return m ? `https://www.youtube-nocookie.com/embed/${m[1]}` : null;
}

export function generateStaticParams() {
  if (!clientConfig.modules.propiedades) return [];
  return (clientConfig.properties ?? []).map((p) => ({ slug: p.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const property = (clientConfig.properties ?? []).find((p) => p.slug === params.slug);
  if (!property) return {};
  return {
    title: `${property.title} — ${clientConfig.meta.businessName}`,
    description: `${OPERATION_LABEL[property.operation]} en ${property.comuna}: ${property.description.slice(0, 140)}`,
  };
}

export default function PropiedadPage({ params }: { params: { slug: string } }) {
  const { modules, contact, syndication } = clientConfig;
  const property = (clientConfig.properties ?? []).find((p) => p.slug === params.slug);
  if (!modules.propiedades || !property) notFound();

  const hasWhatsapp = modules.whatsappButton && Boolean(contact.whatsapp);
  const embed = property.video ? toYouTubeEmbed(property.video) : null;
  const waHref = contact.whatsapp
    ? buildWhatsAppLink(contact.whatsapp, `Hola! Me interesa la propiedad "${property.title}" (${property.comuna}) que vi en su sitio`)
    : "#contacto";
  const portals = [
    syndication?.portalinmobiliario && "Portalinmobiliario",
    syndication?.instagram && "Instagram",
    syndication?.tiktok && "TikTok",
  ].filter(Boolean);

  const specs = [
    property.bedrooms != null && { icon: BedDouble, label: `${property.bedrooms} dormitorios` },
    property.bathrooms != null && { icon: Bath, label: `${property.bathrooms} baños` },
    property.area != null && { icon: Ruler, label: `${property.area} m²` },
    property.parking != null && property.parking > 0 && { icon: Car, label: `${property.parking} estac.` },
  ].filter(Boolean) as { icon: typeof BedDouble; label: string }[];

  return (
    <>
      <Header config={clientConfig} />
      <main className="py-10 sm:py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <Link href="/propiedades" className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground/60 hover:text-primary">
            <ArrowLeft size={15} /> Todas las propiedades
          </Link>

          <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
            <div>
              <span className="bg-primary px-3 py-1 text-xs font-semibold uppercase tracking-wider text-white">
                {OPERATION_LABEL[property.operation]}
              </span>
              <h1 className="mt-3 font-heading text-3xl font-bold text-foreground sm:text-4xl">{property.title}</h1>
              <p className="mt-1 text-sm font-medium uppercase tracking-wider text-foreground/60">{property.comuna}</p>
            </div>
            <p className="font-heading text-3xl font-bold text-primary">{property.price}</p>
          </div>

          {/* Galería */}
          <div className={`mt-8 grid gap-3 ${property.images.length > 1 ? "sm:grid-cols-3" : ""}`}>
            <div className={`relative aspect-[4/3] overflow-hidden ${property.images.length > 1 ? "sm:col-span-2 sm:row-span-2" : "sm:aspect-[16/9]"}`}>
              <Image src={property.images[0]} alt={property.title} fill priority className="object-cover" />
            </div>
            {property.images.slice(1, 5).map((img, i) => (
              <div key={img} className="relative aspect-[4/3] overflow-hidden">
                <Image src={img} alt={`${property.title} — foto ${i + 2}`} fill className="object-cover" />
              </div>
            ))}
          </div>

          {/* Video */}
          {embed && (
            <div className="mt-8">
              <h2 className="font-heading text-lg font-semibold text-foreground">Recorrido en video</h2>
              <div className="relative mt-3 aspect-video overflow-hidden">
                <iframe
                  src={embed}
                  title={`Video de ${property.title}`}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="absolute inset-0 h-full w-full border-0"
                />
              </div>
            </div>
          )}

          <div className="mt-10 grid gap-10 lg:grid-cols-3">
            <div className="lg:col-span-2">
              {specs.length > 0 && (
                <div className="flex flex-wrap gap-6 border-y border-foreground/15 py-5">
                  {specs.map(({ icon: Icon, label }) => (
                    <span key={label} className="flex items-center gap-2 text-sm text-foreground/80">
                      <Icon size={17} className="text-primary" /> {label}
                    </span>
                  ))}
                </div>
              )}
              <p className="mt-6 leading-relaxed text-foreground/80">{property.description}</p>
              {portals.length > 0 && (
                <p className="mt-6 text-xs font-medium uppercase tracking-wider text-foreground/50">
                  Publicada también en {portals.join(" · ")}
                </p>
              )}
            </div>
            <aside className="h-fit border border-foreground/15 p-6">
              <p className="font-heading text-base font-semibold text-foreground">¿Te interesa esta propiedad?</p>
              <p className="mt-2 text-sm text-foreground/70">
                Coordina una visita o pregunta lo que quieras — respondemos al tiro.
              </p>
              <a
                href={waHref}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex w-full items-center justify-center bg-primary px-5 py-3 text-sm font-semibold uppercase tracking-wider text-white hover:opacity-90"
              >
                Consultar por WhatsApp
              </a>
            </aside>
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
