import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { clientConfig } from "@/config/client.config";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { SetupPasswordForm } from "@/components/auth/SetupPasswordForm";
import { findBySetupToken } from "@/lib/admin-users-store";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `Crear contraseña — ${clientConfig.meta.businessName}`,
  robots: { index: false, follow: false },
};

// Link de un solo uso que se manda a una cuenta recién invitada (ver
// inviteAdmin en lib/admin-users-store.ts) para que ELLA defina su propia
// contraseña — nunca pasa por quien la invitó. El token expira solo (48h) y
// se consume al usarse.
export default async function SetupPage({ searchParams }: { searchParams: { token?: string } }) {
  if (!clientConfig.modules.eventos) notFound();

  const token = searchParams.token ?? "";
  const credential = await findBySetupToken(token);

  return (
    <>
      <Header config={clientConfig} />
      <main className="py-14 sm:py-20">
        <div className="mx-auto max-w-sm px-4 sm:px-6">
          <div className="rounded-2xl border border-foreground/10 bg-background px-6 py-10 text-center shadow-sm sm:px-10">
            {/* eslint-disable-next-line @next/next/no-img-element -- mismo patrón que AdminLoginCard.tsx */}
            <img
              src={clientConfig.branding.logoUrl}
              alt={clientConfig.meta.businessName}
              className="mx-auto h-12 w-auto object-contain"
            />
            <p className="mt-6 text-xs font-semibold uppercase tracking-[0.3em] text-primary">Panel del negocio</p>
            <h1 className="mt-2 font-heading text-2xl font-bold text-foreground">Crea tu contraseña</h1>

            {!credential ? (
              <p className="mt-4 text-sm text-foreground/60">
                Este link no es válido o ya expiró — pide uno nuevo desde el panel.
              </p>
            ) : (
              <div className="mt-6">
                <SetupPasswordForm token={token} email={credential.email} />
              </div>
            )}
          </div>
        </div>
      </main>
      <Footer config={clientConfig} />
    </>
  );
}
