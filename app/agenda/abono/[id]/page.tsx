import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { clientConfig } from "@/config/client.config";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { getBooking } from "@/lib/booking-store";
import { formatCLP } from "@/lib/clp";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `Abono de tu reserva — ${clientConfig.meta.businessName}`,
  robots: { index: false },
};

const COPY: Record<string, { title: string; body: string }> = {
  pagada: {
    title: "¡Abono pagado — hora confirmada!",
    body: "Recibimos tu abono y tu reserva quedó confirmada automáticamente. Te esperamos.",
  },
  rechazada: {
    title: "Pago rechazado",
    body: "Webpay rechazó el pago y no se realizó ningún cobro. Tu reserva sigue tomada — puedes reintentar el abono o coordinarlo por WhatsApp.",
  },
  anulada: {
    title: "Pago cancelado",
    body: "El pago fue cancelado antes de completarse. Tu reserva sigue tomada, pendiente de abono.",
  },
  error: {
    title: "No pudimos confirmar el pago",
    body: "Ocurrió un problema al confirmar con Webpay. Si el cargo aparece en tu tarjeta, escríbenos y lo resolvemos al tiro.",
  },
};

export default async function AbonoPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { estado?: string; monto?: string; auth?: string; card?: string };
}) {
  const { modules, meta, contact } = clientConfig;
  if (!modules.agenda) notFound();

  const estado = searchParams.estado ?? "error";
  const copy = COPY[estado] ?? COPY.error;
  const paid = estado === "pagada";
  const booking = await getBooking(params.id);
  const monto = searchParams.monto ? Number(searchParams.monto) : booking?.payment?.amount;

  const wspMessage = encodeURIComponent(
    `Hola! Soy ${booking?.name ?? "cliente"} — sobre mi reserva ${params.id}${paid ? " (abono pagado)" : " (abono pendiente)"}.`
  );

  return (
    <>
      <Header config={clientConfig} />
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
                <dt className="text-foreground/60">Reserva</dt>
                <dd className="font-semibold text-foreground">{params.id}</dd>
              </div>
              {booking ? (
                <div className="flex justify-between">
                  <dt className="text-foreground/60">Hora</dt>
                  <dd className="font-semibold text-foreground">
                    {booking.service} — {booking.date} {booking.time}
                  </dd>
                </div>
              ) : null}
              {monto ? (
                <div className="flex justify-between">
                  <dt className="text-foreground/60">Abono</dt>
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

            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              {contact.whatsapp ? (
                <a
                  href={`https://wa.me/${contact.whatsapp}?text=${wspMessage}`}
                  className="rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-white hover:opacity-90"
                >
                  Escribir por WhatsApp
                </a>
              ) : null}
              <a
                href="/agenda"
                className="rounded-full border border-black/10 px-6 py-2.5 text-sm font-semibold text-foreground/80 hover:border-primary hover:text-primary"
              >
                Volver a la agenda
              </a>
            </div>
          </div>
        </div>
      </main>
      <Footer config={clientConfig} />
    </>
  );
}
