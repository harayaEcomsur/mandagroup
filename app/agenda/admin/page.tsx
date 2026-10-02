import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { clientConfig } from "@/config/client.config";
import { Header } from "@/components/layout/Header";
import { AdminAgenda } from "@/components/agenda/AdminAgenda";
import { AdminLoginCard } from "@/components/auth/AdminLoginCard";
import { currentAgendaUser, googleLoginEnabled, claveLoginEnabled, isClaveSession } from "@/lib/auth";
import { resolveVocabulary } from "@/lib/vocabulary";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `Panel de agenda — ${clientConfig.meta.businessName}`,
  robots: { index: false, follow: false },
};

// Panel del negocio — admin y staff (ej. cada barbero/peluquera), ver
// lib/auth.ts. Dos formas de entrar, ambas opcionales: (1) cuenta de Google,
// autorizada contra config.admin.users; (2) el link con clave heredado
// (?clave=…, siempre admin), mientras AGENDA_ADMIN_KEY exista. Qué puede tocar
// cada rol se resuelve adentro de AdminAgenda según lo que devuelva la API.
export default async function AgendaAdminPage({ searchParams }: { searchParams: { clave?: string } }) {
  if (!clientConfig.modules.agenda) notFound();
  const adminKey = process.env.AGENDA_ADMIN_KEY;
  const user = await currentAgendaUser(searchParams.clave ?? null);
  const authorized = Boolean(user);
  // Deriva de la IDENTIDAD resuelta (cookie o ?clave= heredado), no de si esta
  // request en particular traía la query string — si no, la tarjeta del feed
  // de Calendario (que usa adminKey) desaparecería para siempre en cuanto
  // alguien entre por el formulario nuevo en vez de un link con ?clave=.
  const claveSession = isClaveSession(user);
  const googleEnabled = googleLoginEnabled();
  const claveEnabled = claveLoginEnabled();

  return (
    <>
      <Header config={clientConfig} />
      <main className="py-14 sm:py-20">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          {!authorized ? (
            <div className="mt-8">
              <AdminLoginCard
                businessName={clientConfig.meta.businessName}
                logoUrl={clientConfig.branding.logoUrl}
                description="Este panel administra tus reservas: confirmar, cancelar, bloquear horarios y configurar avisos — no es un módulo de pago."
                googleEnabled={googleEnabled}
                claveEnabled={claveEnabled}
              />
            </div>
          ) : (
            <>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">Panel del negocio</p>
              <h1 className="mt-3 font-heading text-3xl font-bold text-foreground">Administrar agenda</h1>
              <div className="mt-8">
                <AdminAgenda
                  adminKey={claveSession ? adminKey : undefined}
                  notifyEmail={process.env.BOOKINGS_NOTIFY_EMAIL ?? null}
                  businessName={clientConfig.meta.businessName}
                  services={clientConfig.services.map((s) => ({ title: s.title, durationMinutes: s.durationMinutes, price: s.price }))}
                  dentalRecords={clientConfig.modules.dentalRecords}
                  expenses={clientConfig.modules.expenses}
                  multiBranch={clientConfig.modules.multiBranch}
                  vocabulary={resolveVocabulary(clientConfig.vocabulary)}
                />
              </div>
            </>
          )}
        </div>
      </main>
    </>
  );
}
