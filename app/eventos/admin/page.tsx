import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { clientConfig } from "@/config/client.config";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { AdminLoginCard } from "@/components/auth/AdminLoginCard";
import { AdminEventos } from "@/components/eventos/AdminEventos";
import { currentAdminUser, googleLoginEnabled, passwordLoginEnabled, claveLoginEnabled, isClaveSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `Panel de eventos — ${clientConfig.meta.businessName}`,
  robots: { index: false, follow: false },
};

// Panel del reemplazo de ManyChat: número de WhatsApp de reservas, eventos
// activos con su link de entradas, y las estadísticas de derivaciones — mismo
// mecanismo de acceso (Google o clave heredada) que /agenda/admin y
// /tienda/admin, ver lib/auth.ts.
export default async function EventosAdminPage({ searchParams }: { searchParams: { clave?: string } }) {
  if (!clientConfig.modules.eventos) notFound();

  const user = await currentAdminUser(searchParams.clave ?? null);
  const googleEnabled = googleLoginEnabled();
  const passwordEnabled = await passwordLoginEnabled();
  const claveEnabled = claveLoginEnabled();

  return (
    <>
      <Header config={clientConfig} />
      <main className="py-14 sm:py-20">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          {!user ? (
            <div className="mt-8">
              <AdminLoginCard
                businessName={clientConfig.meta.businessName}
                logoUrl={clientConfig.branding.logoUrl}
                description="Este panel administra el número de reservas, los links de entradas por evento, y las estadísticas de WhatsApp/Instagram/web."
                googleEnabled={googleEnabled}
                passwordEnabled={passwordEnabled}
                claveEnabled={claveEnabled}
              />
            </div>
          ) : (
            <>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">Panel del negocio</p>
              <h1 className="mt-3 font-heading text-3xl font-bold text-foreground">Reservas, entradas y estadísticas</h1>
              <div className="mt-8">
                <AdminEventos adminKey={isClaveSession(user) ? (searchParams.clave ?? null) : null} />
              </div>
            </>
          )}
        </div>
      </main>
      <Footer config={clientConfig} />
    </>
  );
}
