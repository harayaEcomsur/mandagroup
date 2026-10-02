import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getEmbedTenant } from "@/config/embed-tenants";
import { adminKeyMatches } from "@/lib/embed-admin";
import { listBookings } from "@/lib/embed-agenda";
import { listOrders } from "@/lib/embed-store";
import { PanelClient } from "@/components/embed/PanelClient";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata: Metadata = {
  title: "Panel del negocio — HarayaDev",
  robots: { index: false, follow: false },
};

export default async function EmbedPanelPage({
  searchParams,
}: {
  searchParams: { t?: string; clave?: string };
}) {
  const tenant = getEmbedTenant(searchParams.t);
  if (!tenant) notFound();

  const authorized = adminKeyMatches(searchParams.clave, tenant.id);

  if (!authorized) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16 font-sans">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-red-500">Panel del negocio</p>
        <h1 className="mt-3 text-3xl font-bold text-slate-900">{tenant.businessName}</h1>
        <div className="mt-8 rounded-xl border border-slate-200 p-6 text-slate-600">
          <p>
            Este panel muestra tus reservas y pedidos. Entra con tu <strong>link de administración</strong>{" "}
            <code className="rounded bg-slate-100 px-1.5 py-0.5 text-sm">/embed/panel?t={tenant.id}&amp;clave=…</code>.
          </p>
          <p className="mt-3 text-sm">Si no lo tienes, pídelo a HarayaDev.</p>
        </div>
      </main>
    );
  }

  const [bookings, orders] = await Promise.all([listBookings(tenant), listOrders(tenant.id)]);

  return (
    <main className="mx-auto max-w-4xl px-4 py-12 font-sans">
      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-red-500">Panel del negocio</p>
      <h1 className="mt-3 text-3xl font-bold text-slate-900">{tenant.businessName}</h1>
      <p className="mt-1 text-sm text-slate-500">Reservas y pedidos de tu asistente. Se actualiza al recargar.</p>

      <PanelClient
        tenantId={tenant.id}
        clave={searchParams.clave ?? ""}
        bookings={bookings}
        orders={orders}
        hasAgenda={!!tenant.agenda}
        hasStore={!!tenant.store}
      />
    </main>
  );
}
