import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { clientConfig } from "@/config/client.config";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { ClearCartOnSuccess } from "@/components/store/ClearCartOnSuccess";
import { getOrder } from "@/lib/order-store";
import { formatCLP } from "@/lib/clp";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `Tu pedido — ${clientConfig.meta.businessName}`,
  robots: { index: false },
};

const COPY: Record<string, { title: string; body: string }> = {
  pagada: {
    title: "¡Pago aprobado!",
    body: "Recibimos tu pedido y el pago fue confirmado por Webpay.",
  },
  rechazada: {
    title: "Pago rechazado",
    body: "Webpay rechazó el pago. No se realizó ningún cobro — puedes intentar de nuevo con otra tarjeta.",
  },
  anulada: {
    title: "Pago cancelado",
    body: "El pago fue cancelado antes de completarse. Tu carrito sigue guardado si quieres reintentar.",
  },
  error: {
    title: "No pudimos confirmar el pago",
    body: "Ocurrió un problema al confirmar con Webpay. Si el cargo aparece en tu tarjeta, escríbenos y lo resolvemos al tiro.",
  },
};

export default async function PedidoPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { estado?: string; monto?: string; auth?: string; card?: string };
}) {
  const { modules, store, meta, contact } = clientConfig;
  if (!modules.tienda || !store) notFound();

  const estado = searchParams.estado ?? "error";
  const copy = COPY[estado] ?? COPY.error;
  const paid = estado === "pagada";
  const order = await getOrder(params.id);
  const monto = searchParams.monto ? Number(searchParams.monto) : order?.total;

  const wspMessage = encodeURIComponent(
    `Hola! Acabo de hacer el pedido ${params.id} en la tienda${paid ? " (pago aprobado)" : ""}.`
  );

  return (
    <>
      <Header config={clientConfig} />
      <ClearCartOnSuccess storageKey={`cart:${meta.slug}`} paid={paid} />
      <main className="py-14 sm:py-20">
        <div className="mx-auto max-w-2xl px-4 sm:px-6">
          <div className="rounded-2xl border border-black/5 bg-white p-8 text-center shadow-sm">
            {paid ? (
              <CheckCircle2 size={48} className="mx-auto text-green-600" />
            ) : estado === "error" ? (
              <AlertTriangle size={48} className="mx-auto text-amber-500" />
            ) : (
              <XCircle size={48} className="mx-auto text-red-500" />
            )}
            <h1 className="mt-4 font-heading text-2xl font-bold text-foreground sm:text-3xl">{copy.title}</h1>
            <p className="mt-2 text-foreground/70">{copy.body}</p>

            <dl className="mt-6 space-y-1 rounded-xl bg-black/[0.03] p-4 text-left text-sm">
              <div className="flex justify-between">
                <dt className="text-foreground/60">N° de pedido</dt>
                <dd className="font-semibold text-foreground">{params.id}</dd>
              </div>
              {monto ? (
                <div className="flex justify-between">
                  <dt className="text-foreground/60">Monto</dt>
                  <dd className="font-semibold text-foreground">{formatCLP(monto)}</dd>
                </div>
              ) : null}
              {paid && searchParams.auth ? (
                <div className="flex justify-between">
                  <dt className="text-foreground/60">Código de autorización</dt>
                  <dd className="font-semibold text-foreground">{searchParams.auth}</dd>
                </div>
              ) : null}
              {paid && searchParams.card ? (
                <div className="flex justify-between">
                  <dt className="text-foreground/60">Tarjeta</dt>
                  <dd className="font-semibold text-foreground">**** {searchParams.card}</dd>
                </div>
              ) : null}
            </dl>

            {order?.items.length ? (
              <ul className="mt-4 divide-y divide-black/5 text-left text-sm">
                {order.items.map((i) => (
                  <li key={i.slug} className="flex justify-between py-2">
                    <span className="text-foreground/80">
                      {i.qty} × {i.name}
                    </span>
                    <span className="text-foreground">{formatCLP(i.price * i.qty)}</span>
                  </li>
                ))}
              </ul>
            ) : null}

            {paid ? <p className="mt-6 text-sm text-foreground/70">{store.shippingNote}</p> : null}

            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              {contact.whatsapp ? (
                <a
                  href={`https://wa.me/${contact.whatsapp}?text=${wspMessage}`}
                  className="rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-white hover:opacity-90"
                >
                  Avisar por WhatsApp
                </a>
              ) : null}
              <a href="/tienda" className="rounded-full border border-black/10 px-6 py-2.5 text-sm font-semibold text-foreground/80 hover:border-primary hover:text-primary">
                {paid ? "Seguir comprando" : "Volver a la tienda"}
              </a>
            </div>
          </div>
        </div>
      </main>
      <Footer config={clientConfig} />
    </>
  );
}
