import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { clientConfig } from "@/config/client.config";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { GoogleLoginButton } from "@/components/auth/GoogleLoginButton";
import { currentAdminUser, googleLoginEnabled, claveLoginEnabled } from "@/lib/auth";
import { listOrders } from "@/lib/order-store";
import { formatCLP } from "@/lib/clp";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `Pedidos — ${clientConfig.meta.businessName}`,
  robots: { index: false },
};

const STATUS_STYLE: Record<string, string> = {
  pagada: "bg-green-100 text-green-800",
  pendiente_pago: "bg-amber-100 text-amber-800",
  rechazada: "bg-red-100 text-red-700",
  anulada: "bg-black/5 text-foreground/60",
};

// Antes este panel no pedía nada: cualquiera con el link veía nombre,
// teléfono, correo y dirección de cada comprador. Ahora usa el mismo gate
// (Google o clave heredada) que /agenda/admin — ver lib/auth.ts. Solo admin,
// a diferencia de la agenda: el staff no administra pedidos de la tienda.
export default async function PedidosAdminPage({ searchParams }: { searchParams: { clave?: string } }) {
  const { modules } = clientConfig;
  if (!modules.tienda) notFound();

  const authorized = Boolean(await currentAdminUser(searchParams.clave ?? null));
  const googleEnabled = googleLoginEnabled();
  const claveEnabled = claveLoginEnabled();

  if (!authorized) {
    return (
      <>
        <Header config={clientConfig} />
        <main className="py-14 sm:py-20">
          <div className="mx-auto max-w-4xl px-4 sm:px-6">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">Panel del dueño</p>
            <h1 className="mt-3 font-heading text-3xl font-bold text-foreground">Pedidos</h1>
            <div className="mt-8 flex flex-col gap-6 rounded-xl border border-black/10 p-6">
              <p className="text-foreground/70">Este panel muestra los datos de tus compradores — solo tú deberías verlo.</p>
              {googleEnabled && (
                <div>
                  <p className="mb-3 text-sm font-semibold text-foreground">Entra con tu cuenta de Google</p>
                  <GoogleLoginButton clientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!} />
                </div>
              )}
              {claveEnabled && (
                <p className="text-foreground/70">
                  {googleEnabled ? "También puedes entrar" : "Ingresa"} con tu link de administración{" "}
                  <code className="rounded bg-foreground/10 px-1.5 py-0.5 text-sm">/tienda/admin?clave=…</code>.
                </p>
              )}
              {!googleEnabled && !claveEnabled && (
                <p className="text-foreground/70">
                  El acceso al panel no está configurado todavía — contacta a HarayaDev para activarlo.
                </p>
              )}
            </div>
          </div>
        </main>
        <Footer config={clientConfig} />
      </>
    );
  }

  const orders = (await listOrders());

  return (
    <>
      <Header config={clientConfig} />
      <main className="py-14 sm:py-20">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">Panel del dueño</p>
          <h1 className="mt-3 font-heading text-3xl font-bold text-foreground">Pedidos</h1>
          <p className="mt-2 text-sm text-foreground/60">
            Demo: los pedidos viven en memoria del servidor. En producción se respaldan en base de datos y
            este panel incluye estados de despacho.
          </p>

          {orders.length === 0 ? (
            <p className="mt-10 rounded-2xl border border-black/5 bg-white p-8 text-center text-foreground/60 shadow-sm">
              Aún no hay pedidos. Cuando alguien compre en /tienda, aparecerán aquí.
            </p>
          ) : (
            <div className="mt-8 space-y-4">
              {orders.map((o) => (
                <article key={o.id} className="rounded-2xl border border-black/5 bg-white p-5 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-heading font-semibold text-foreground">
                      {o.id} · {formatCLP(o.total)}
                    </p>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_STYLE[o.status] ?? ""}`}>
                      {o.status.replace("_", " ")}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-foreground/70">
                    {o.buyer.name} · {o.buyer.phone} · {o.buyer.email}
                    {o.buyer.address ? ` · ${o.buyer.address}` : ""}
                  </p>
                  <ul className="mt-2 text-sm text-foreground/80">
                    {o.items.map((i) => (
                      <li key={i.slug}>
                        {i.qty} × {i.name} — {formatCLP(i.price * i.qty)}
                      </li>
                    ))}
                  </ul>
                  {o.buyer.note ? <p className="mt-2 text-xs text-foreground/60">Nota: {o.buyer.note}</p> : null}
                </article>
              ))}
            </div>
          )}
        </div>
      </main>
      <Footer config={clientConfig} />
    </>
  );
}
