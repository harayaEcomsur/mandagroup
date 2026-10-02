import type { Metadata } from "next";
import { clientConfig } from "@/config/client.config";
import { Header } from "@/components/layout/Header";
import { buildPrivacySections } from "@/lib/privacy-content";
import { ArcoRequestForm } from "@/components/privacy/ArcoRequestForm";

export const metadata: Metadata = {
  title: `Política de privacidad — ${clientConfig.meta.businessName}`,
};

// Política de privacidad dinámica (ver lib/privacy-content.ts) + el canal para
// ejercer derechos ARCO+ (Ley 21.719). Página pública, sin login: cualquiera
// que haya interactuado con el negocio puede llegar acá.
export default function PrivacidadPage() {
  const sections = buildPrivacySections();

  return (
    <>
      <Header config={clientConfig} />
      <main className="py-14 sm:py-20">
        <div className="mx-auto max-w-2xl px-4 sm:px-6">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">Tus datos</p>
          <h1 className="mt-3 font-heading text-3xl font-bold text-foreground">Política de privacidad</h1>
          <p className="mt-3 text-sm text-foreground/60">Última actualización: {new Date().toLocaleDateString("es-CL", { year: "numeric", month: "long" })}.</p>

          <div className="mt-8 flex flex-col gap-8">
            {sections.map((s) => (
              <section key={s.title}>
                <h2 className="mb-2 font-heading text-lg font-semibold text-foreground">{s.title}</h2>
                <div className="flex flex-col gap-2 text-foreground/75">
                  {s.body.map((p, i) => (
                    <p key={i}>{p}</p>
                  ))}
                </div>
              </section>
            ))}
          </div>

          <div className="mt-10">
            <h2 className="mb-3 font-heading text-lg font-semibold text-foreground">Solicitar mis datos</h2>
            <ArcoRequestForm />
          </div>
        </div>
      </main>
    </>
  );
}
