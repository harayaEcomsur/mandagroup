import { clientConfig } from "@/config/client.config";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { WhatsAppButton } from "@/components/layout/WhatsAppButton";
import { ChatWidget } from "@/components/chat/ChatWidget";
import { Hero } from "@/components/sections/Hero";
import { Services } from "@/components/sections/Services";
import { About } from "@/components/sections/About";
import { Gallery } from "@/components/sections/Gallery";
import { HeroInmobiliaria } from "@/components/layouts/inmobiliaria/HeroInmobiliaria";
import { ServicesInmobiliaria } from "@/components/layouts/inmobiliaria/ServicesInmobiliaria";
import { GalleryInmobiliaria } from "@/components/layouts/inmobiliaria/GalleryInmobiliaria";
import { HeroCorporativo } from "@/components/layouts/corporativo/HeroCorporativo";
import { FeaturedProperties } from "@/components/properties/FeaturedProperties";
import { ServicesCorporativo } from "@/components/layouts/corporativo/ServicesCorporativo";
import { HeroSalud } from "@/components/layouts/salud/HeroSalud";
import { ServicesSalud } from "@/components/layouts/salud/ServicesSalud";
import { HeroBelleza } from "@/components/layouts/belleza/HeroBelleza";
import { ServicesBelleza } from "@/components/layouts/belleza/ServicesBelleza";
import { Testimonials } from "@/components/sections/Testimonials";
import { InstagramFeed } from "@/components/social/InstagramFeed";
import { FAQ } from "@/components/sections/FAQ";
import { Pricing } from "@/components/sections/Pricing";
import { ContactForm } from "@/components/sections/ContactForm";
import { MapEmbed } from "@/components/sections/MapEmbed";
import { Container } from "@/components/ui/Container";
import { getServicePrices } from "@/lib/booking-store";

export async function HomeContent() {
  const { modules, contact, branding, meta } = clientConfig;
  const hasWhatsapp = modules.whatsappButton && Boolean(contact.whatsapp);
  const layout = branding.layout;
  const gallery = clientConfig.gallery ?? [];
  const instagramUrl = contact.socials?.find((s) => s.platform === "instagram")?.url;

  // El precio que el dueño haya guardado desde el panel de agenda manda sobre
  // el del config — mismo mecanismo que la duración de cada servicio.
  const priceOverrides = await getServicePrices();
  const servicesData = clientConfig.services.map((s) => ({ ...s, price: priceOverrides[s.title] ?? s.price }));

  // Cada layout intercambia hero, servicios y galería para que dos clientes de
  // rubros distintos no se vean como el mismo sitio con otra paleta. El resto
  // de las secciones (nosotros, testimonios, precios, FAQ, contacto) es común.
  const hero =
    layout === "inmobiliaria" ? (
      <HeroInmobiliaria hero={clientConfig.hero} rubro={meta.rubro} hasGallery={gallery.length > 0} />
    ) : layout === "corporativo" ? (
      <HeroCorporativo hero={clientConfig.hero} rubro={meta.rubro} />
    ) : layout === "salud" ? (
      <HeroSalud hero={clientConfig.hero} rubro={meta.rubro} />
    ) : layout === "belleza" ? (
      <HeroBelleza hero={clientConfig.hero} rubro={meta.rubro} />
    ) : (
      <Hero hero={clientConfig.hero} />
    );

  const services =
    layout === "inmobiliaria" ? (
      <ServicesInmobiliaria services={servicesData} />
    ) : layout === "corporativo" ? (
      <ServicesCorporativo services={servicesData} />
    ) : layout === "salud" ? (
      <ServicesSalud services={servicesData} />
    ) : layout === "belleza" ? (
      <ServicesBelleza services={servicesData} />
    ) : (
      <Services services={servicesData} />
    );

  // Con el módulo de propiedades activo, el inventario real reemplaza a la galería.
  const hasProperties = modules.propiedades && (clientConfig.properties?.length ?? 0) > 0;
  const gallerySection = hasProperties ? (
    <FeaturedProperties properties={clientConfig.properties!} />
  ) : !gallery.length ? null : layout === "inmobiliaria" ? (
    <GalleryInmobiliaria images={gallery} />
  ) : (
    <Gallery images={gallery} />
  );

  return (
    <>
      <Header config={clientConfig} />
      <main>
        {hero}
        {services}
        <About about={clientConfig.about} />
        {gallerySection}
        {modules.testimonials && clientConfig.testimonials?.length ? (
          <Testimonials testimonials={clientConfig.testimonials} />
        ) : null}
        {instagramUrl ? <InstagramFeed instagramUrl={instagramUrl} businessName={meta.businessName} /> : null}
        {modules.pricing && clientConfig.pricing?.length ? <Pricing plans={clientConfig.pricing} /> : null}
        {modules.faq && clientConfig.faq?.length ? <FAQ items={clientConfig.faq} /> : null}
        <section id="contacto" className="py-16 sm:py-24">
          <Container className="grid gap-10 lg:grid-cols-2">
            <div className="space-y-6">
              <h2 className="font-heading text-3xl font-bold text-foreground">Contacto</h2>
              {contact.address && <MapEmbed query={contact.mapQuery ?? contact.address} />}
            </div>
            {modules.contactForm ? <ContactForm /> : null}
          </Container>
        </section>
      </main>
      <Footer config={clientConfig} />
      {hasWhatsapp && contact.whatsapp ? (
        <WhatsAppButton phone={contact.whatsapp} message={contact.whatsappPrefilledMessage} />
      ) : null}
      {modules.chat ? (
        <ChatWidget businessName={clientConfig.meta.businessName} stacked={hasWhatsapp} />
      ) : null}
    </>
  );
}
