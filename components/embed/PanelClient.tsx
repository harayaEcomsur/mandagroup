"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { EmbedBooking } from "@/lib/embed-agenda";
import type { EmbedOrder } from "@/lib/embed-store";

const clp = (n: number) => "$" + n.toLocaleString("es-CL");
function fecha(d: string): string {
  return new Intl.DateTimeFormat("es-CL", { weekday: "short", day: "numeric", month: "short" }).format(
    new Date(d + "T12:00:00")
  );
}

const STATUS_STYLE: Record<string, string> = {
  pendiente: "bg-amber-100 text-amber-800",
  confirmada: "bg-emerald-100 text-emerald-800",
  pagado: "bg-emerald-100 text-emerald-800",
  entregado: "bg-sky-100 text-sky-800",
  cancelada: "bg-red-100 text-red-700",
  rechazado: "bg-red-100 text-red-700",
};
function Badge({ status }: { status: string }) {
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLE[status] ?? "bg-slate-100 text-slate-700"}`}>
      {status}
    </span>
  );
}

type Action = "confirmar_reserva" | "cancelar_reserva" | "entregar_pedido";

export function PanelClient({
  tenantId,
  clave,
  bookings,
  orders,
  hasAgenda,
  hasStore,
}: {
  tenantId: string;
  clave: string;
  bookings: EmbedBooking[];
  orders: EmbedOrder[];
  hasAgenda: boolean;
  hasStore: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function act(action: Action, id: string) {
    setBusy(id + action);
    setError(null);
    try {
      const res = await fetch("/api/embed/panel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ t: tenantId, clave, action, id }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error ?? "No se pudo completar la acción.");
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(null);
    }
  }

  const btn =
    "rounded-md px-2.5 py-1 text-xs font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed";

  return (
    <>
      {error && (
        <p className="mt-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>
      )}

      {hasAgenda && (
        <section className="mt-10">
          <h2 className="text-lg font-semibold text-slate-800">Reservas ({bookings.length})</h2>
          {bookings.length === 0 ? (
            <p className="mt-3 text-slate-500">Aún no hay reservas.</p>
          ) : (
            <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-4 py-2 font-medium">Fecha</th>
                    <th className="px-4 py-2 font-medium">Hora</th>
                    <th className="px-4 py-2 font-medium">Servicio</th>
                    <th className="px-4 py-2 font-medium">Cliente</th>
                    <th className="px-4 py-2 font-medium">Estado</th>
                    <th className="px-4 py-2 font-medium">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {bookings.map((b) => (
                    <tr key={b.id}>
                      <td className="px-4 py-2 text-slate-700">{fecha(b.date)}</td>
                      <td className="px-4 py-2 text-slate-700">{b.time}</td>
                      <td className="px-4 py-2 text-slate-700">{b.service}</td>
                      <td className="px-4 py-2 text-slate-700">
                        {b.name}
                        <span className="block text-xs text-slate-400">{b.phone}</span>
                      </td>
                      <td className="px-4 py-2"><Badge status={b.status} /></td>
                      <td className="px-4 py-2">
                        <div className="flex gap-1.5">
                          {b.status === "pendiente" && (
                            <button
                              className={`${btn} bg-emerald-600 text-white hover:bg-emerald-700`}
                              disabled={busy !== null}
                              onClick={() => act("confirmar_reserva", b.id)}
                            >
                              {busy === b.id + "confirmar_reserva" ? "…" : "Confirmar"}
                            </button>
                          )}
                          {b.status !== "cancelada" && (
                            <button
                              className={`${btn} bg-slate-100 text-slate-700 hover:bg-slate-200`}
                              disabled={busy !== null}
                              onClick={() => act("cancelar_reserva", b.id)}
                            >
                              {busy === b.id + "cancelar_reserva" ? "…" : "Cancelar"}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {hasStore && (
        <section className="mt-10">
          <h2 className="text-lg font-semibold text-slate-800">Pedidos ({orders.length})</h2>
          {orders.length === 0 ? (
            <p className="mt-3 text-slate-500">Aún no hay pedidos.</p>
          ) : (
            <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-4 py-2 font-medium">Pedido</th>
                    <th className="px-4 py-2 font-medium">Productos</th>
                    <th className="px-4 py-2 font-medium">Total</th>
                    <th className="px-4 py-2 font-medium">Cliente</th>
                    <th className="px-4 py-2 font-medium">Estado</th>
                    <th className="px-4 py-2 font-medium">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {orders.map((o) => (
                    <tr key={o.id}>
                      <td className="px-4 py-2 font-mono text-xs text-slate-500">{o.id}</td>
                      <td className="px-4 py-2 text-slate-700">
                        {o.items.map((i) => `${i.qty}× ${i.name}`).join(", ")}
                      </td>
                      <td className="px-4 py-2 text-slate-700">{clp(o.total)}</td>
                      <td className="px-4 py-2 text-slate-700">
                        {o.buyer.name}
                        <span className="block text-xs text-slate-400">{o.buyer.phone}</span>
                      </td>
                      <td className="px-4 py-2"><Badge status={o.status} /></td>
                      <td className="px-4 py-2">
                        {o.status === "pagado" ? (
                          <button
                            className={`${btn} bg-sky-600 text-white hover:bg-sky-700`}
                            disabled={busy !== null}
                            onClick={() => act("entregar_pedido", o.id)}
                          >
                            {busy === o.id + "entregar_pedido" ? "…" : "Marcar entregado"}
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </>
  );
}
