import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { clientConfig } from "@/config/client.config";
import { Header } from "@/components/layout/Header";
import { AdminInmobiliaria } from "@/components/inmobiliaria/AdminInmobiliaria";
import { GoogleLoginButton } from "@/components/auth/GoogleLoginButton";
import { currentBroker, googleLoginEnabledRE, claveLoginEnabledRE } from "@/lib/realestate-auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `Panel inmobiliario — ${clientConfig.meta.businessName}`,
  robots: { index: false, follow: false },
};

// Panel multi-corredor: Rossana (admin) ve y gestiona todo, cada corredora
// gestiona solo lo suyo. Dos formas de entrar, ver lib/realestate-auth.ts:
// cuenta de Google (autorizada contra re_brokers, que Rossana administra desde
// este mismo panel) o el link con clave (?clave=..., siempre admin, para
// entrar la primera vez antes de que exista ningún corredor en la base).
export default async function InmobiliariaAdminPage({ searchParams }: { searchParams: { clave?: string } }) {
  if (!clientConfig.modules.inmobiliariaAdmin) notFound();
  const adminKey = process.env.REALESTATE_ADMIN_KEY;
  const broker = await currentBroker(searchParams.clave ?? null);
  const claveMatched = Boolean(adminKey && searchParams.clave === adminKey);
  const googleEnabled = googleLoginEnabledRE();
  const claveEnabled = claveLoginEnabledRE();

  return (
    <>
      <Header config={clientConfig} />
      <main className="py-14 sm:py-20">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">Panel inmobiliario</p>
          <h1 className="mt-3 font-heading text-3xl font-bold text-foreground">Corredores, propiedades y clientes</h1>
          {!broker ? (
            <div className="mt-8 flex flex-col gap-6 rounded-xl border border-foreground/15 p-6">
              <p className="text-foreground/70">
                Este panel administra corredoras, propiedades, clientes, el directorio de proveedores de confianza, informes de
                entrega/recepción y contratos.
              </p>
              {googleEnabled && (
                <div>
                  <p className="mb-3 text-sm font-semibold text-foreground">Entra con tu cuenta de Google</p>
                  <GoogleLoginButton clientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!} endpoint="/api/auth/google-re" />
                </div>
              )}
              {claveEnabled && (
                <p className="text-foreground/70">
                  {googleEnabled ? "También puedes entrar" : "Ingresa"} con tu link de administración{" "}
                  <code className="rounded bg-foreground/10 px-1.5 py-0.5 text-sm">/inmobiliaria/admin?clave=…</code>.
                </p>
              )}
              {!googleEnabled && !claveEnabled && (
                <p className="text-foreground/70">El acceso al panel no está configurado todavía — contacta a HarayaDev para activarlo.</p>
              )}
            </div>
          ) : (
            <div className="mt-8">
              <AdminInmobiliaria adminKey={claveMatched ? adminKey : undefined} />
            </div>
          )}
        </div>
      </main>
    </>
  );
}
