import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { clientConfig } from "@/config/client.config";
import { Header } from "@/components/layout/Header";
import { listProviders } from "@/lib/realestate-store";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `Proveedores de confianza — ${clientConfig.meta.businessName}`,
};

// Página pública, sin login: el link que se comparte a dueños y arrendatarios
// al entregar una propiedad. Curada por la administradora desde el panel
// /inmobiliaria/admin.
export default async function ProveedoresPage() {
  if (!clientConfig.modules.inmobiliariaAdmin) notFound();
  const providers = await listProviders();
  const byCategory = new Map<string, typeof providers>();
  for (const p of providers) {
    byCategory.set(p.category, [...(byCategory.get(p.category) ?? []), p]);
  }

  return (
    <>
      <Header config={clientConfig} />
      <main className="py-14 sm:py-20">
        <div className="mx-auto max-w-2xl px-4 sm:px-6">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">Para tu hogar</p>
          <h1 className="mt-3 font-heading text-3xl font-bold text-foreground">Proveedores de confianza</h1>
          <p className="mt-3 text-foreground/70">
            Contactos de electricistas, gasfíter, mueblistas y otros oficios que {clientConfig.meta.businessName} recomienda con confianza.
          </p>

          <div className="mt-8 flex flex-col gap-6">
            {[...byCategory.entries()].map(([category, list]) => (
              <div key={category}>
                <h2 className="mb-2 font-heading text-lg font-semibold text-foreground">{category}</h2>
                <ul className="flex flex-col gap-2">
                  {list.map((p) => (
                    <li key={p.name + p.phone} className="rounded-xl border border-foreground/15 p-4">
                      <p className="font-medium text-foreground">{p.name}</p>
                      {p.phone && <p className="text-sm text-foreground/70">{p.phone}</p>}
                      {p.notes && <p className="mt-1 text-sm text-foreground/60">{p.notes}</p>}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            {providers.length === 0 && <p className="text-foreground/60">Todavía no hay proveedores cargados.</p>}
          </div>
        </div>
      </main>
    </>
  );
}
