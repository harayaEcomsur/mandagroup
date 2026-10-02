import type { Metadata } from "next";
import { clientConfig } from "@/config/client.config";

// Página interna para mostrar al cliente 2-3 direcciones de arte y que elija
// ("¿cuál te gusta más: A, B o C?"). Nunca se indexa y no aparece en el sitemap.
export const metadata: Metadata = {
  title: `Variantes de diseño — ${clientConfig.meta.businessName}`,
  robots: { index: false, follow: false },
};

export default function VariantesPage() {
  const variants = clientConfig.themeVariants;

  if (!variants?.length) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-24 text-foreground">
        <h1 className="font-heading text-2xl font-bold">Sin variantes definidas</h1>
        <p className="mt-4 leading-relaxed">
          Agrega <code className="rounded bg-black/10 px-1">themeVariants</code> en{" "}
          <code className="rounded bg-black/10 px-1">config/client.config.ts</code> para previsualizar aquí
          distintas paletas del sitio. <code className="rounded bg-black/10 px-1">npm run palette -- logo.png</code>{" "}
          sugiere variantes automáticamente a partir del logo del cliente.
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background px-4 py-10 text-foreground sm:px-8">
      <div className="mx-auto max-w-[1400px]">
        <h1 className="font-heading text-2xl font-bold sm:text-3xl">
          {clientConfig.meta.businessName} — opciones de diseño
        </h1>
        <p className="mt-2 text-sm opacity-70">
          Misma página, distinta paleta. Toca una opción para verla en pantalla completa.
        </p>
        <div className="mt-8 grid gap-8 lg:grid-cols-2 xl:grid-cols-3">
          {variants.map((v, i) => (
            <a key={v.id} href={`/variantes/${v.id}`} className="group block">
              <div className="flex items-center gap-3">
                <span
                  className="flex h-8 w-8 items-center justify-center rounded-full font-heading text-sm font-bold text-white"
                  style={{ backgroundColor: v.palette.primary }}
                >
                  {String.fromCharCode(65 + i)}
                </span>
                <span className="font-heading font-semibold group-hover:underline">{v.name}</span>
                <span className="ml-auto flex gap-1">
                  {[v.palette.primary, v.palette.accent, v.palette.background].map((c) => (
                    <span key={c} className="h-4 w-4 rounded-full border border-black/10" style={{ backgroundColor: c }} />
                  ))}
                </span>
              </div>
              <div className="mt-3 overflow-hidden rounded-xl border border-black/10 shadow-sm transition-shadow group-hover:shadow-lg">
                <iframe
                  src={`/variantes/${v.id}`}
                  title={`Variante ${v.name}`}
                  className="pointer-events-none h-[420px] w-full origin-top-left scale-50"
                  style={{ width: "200%", height: "840px" }}
                  loading="lazy"
                />
              </div>
            </a>
          ))}
        </div>
      </div>
    </main>
  );
}
