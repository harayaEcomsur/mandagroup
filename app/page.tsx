import { clientConfig } from "@/config/client.config";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { WhatsAppButton } from "@/components/layout/WhatsAppButton";
import { ChatWidget } from "@/components/chat/ChatWidget";
import { MandagroupHome } from "@/components/MandagroupHome";

// La cartelera (DB + Vesti) y el feed de Instagram cambian solos: la home se
// regenera cada 5 min (y al toque cuando el panel toca un evento, ver
// revalidatePath en app/api/eventos/route.ts). Sin esto quedaba congelada con
// los datos del momento del build.
export const revalidate = 300;

// Mandagroup usa una home bespoke (ver MandagroupHome.tsx) en vez de
// components/HomeContent.tsx — mismo Header/Footer/WhatsAppButton/ChatWidget
// que cualquier otro cliente, contenido central a medida.
export default function HomePage() {
  const { modules, contact, meta } = clientConfig;
  const hasWhatsapp = modules.whatsappButton && Boolean(contact.whatsapp);

  return (
    <>
      <Header config={clientConfig} />
      <main>
        <MandagroupHome />
      </main>
      <Footer config={clientConfig} />
      {hasWhatsapp && contact.whatsapp ? (
        <WhatsAppButton phone={contact.whatsapp} message={contact.whatsappPrefilledMessage} />
      ) : null}
      {modules.chat ? (
        <ChatWidget businessName={meta.businessName} stacked={hasWhatsapp} actionButtons={clientConfig.chatActionButtons} />
      ) : null}
    </>
  );
}
