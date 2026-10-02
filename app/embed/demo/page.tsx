import type { Metadata } from "next";
import Script from "next/script";
import { notFound } from "next/navigation";
import { getEmbedTenant } from "@/config/embed-tenants";

// Página de demo del asistente embebible: un link listo para mandarle a un
// prospecto o para probarlo nosotros mismos, sin depender de instalar el
// widget en el sitio real del cliente todavía. Mismo widget.js que se
// instalaría en producción, CERRADO por defecto (sin data-autoopen): así se
// ve el globo con su aviso ("¿Tienes preguntas?") tal como lo vería un
// cliente real, en vez de forzar el chat abierto de entrada. A propósito NO
// muestra el snippet de instalación: eso solo se le entrega al cliente una
// vez contratado, no en la etapa de demo. Si el tenant trae `demoBranding`
// (logo/colores/foto reales de SU sitio, sacados a mano — ver
// embed-tenants.ts), la vista previa los usa para que se sienta como su
// propio sitio; si no, se ve neutra con el rojo de marca de HarayaDev.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: { t?: string };
}): Promise<Metadata> {
  const tenant = getEmbedTenant(searchParams.t);
  return {
    title: tenant ? `Demo — Asistente de ${tenant.businessName}` : "Demo del asistente",
    robots: { index: false, follow: false },
  };
}

export default function EmbedDemoPage({ searchParams }: { searchParams: { t?: string } }) {
  const tenant = getEmbedTenant(searchParams.t);
  if (!tenant) notFound();

  const branding = tenant.demoBranding;
  const primary = branding?.primaryColor ?? "#FF3D3D";
  const widgetColor = branding?.accentColor ?? primary;

  return (
    <main
      className="relative min-h-screen font-sans"
      style={
        branding?.heroImageUrl
          ? {
              backgroundImage: `linear-gradient(rgba(255,255,255,.9), rgba(255,255,255,.95)), url(${branding.heroImageUrl})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }
          : undefined
      }
    >
      <div className="mx-auto max-w-2xl px-4 py-16">
        <p className="text-xs font-semibold uppercase tracking-[0.3em]" style={{ color: primary }}>
          Demo del asistente IA
        </p>
        {branding?.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- logo real hotlinkeado del sitio del prospecto
          <img src={branding.logoUrl} alt={tenant.businessName} className="mt-4 h-14 w-auto" />
        ) : (
          <h1 className="mt-3 text-3xl font-bold text-slate-900">{tenant.businessName}</h1>
        )}
        <p className="mt-1 text-sm text-slate-500">{tenant.rubro}</p>

        <p className="mt-8 text-slate-700">
          {tenant.openStyle === "popup"
            ? "Así conversaría este asistente con tus clientes, directo en tu sitio. Se abre solo — pruébalo."
            : "Así conversaría este asistente con tus clientes, directo en tu sitio. Pruébalo en el globo de abajo a la derecha."}
        </p>
      </div>

      <Script
        src="/widget.js"
        data-tenant={tenant.id}
        data-name={tenant.businessName}
        data-color={widgetColor}
        data-teaser={tenant.teaserMessage}
        data-open-style={tenant.openStyle}
        strategy="afterInteractive"
      />
    </main>
  );
}
