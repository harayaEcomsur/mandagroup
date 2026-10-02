"use client";

import { useState } from "react";
import { ArrowLeft, Loader2, Trash2 } from "lucide-react";
import { formatCLP } from "@/lib/clp";
import { useCart } from "./CartProvider";
import { ConsentCheckbox } from "@/components/privacy/ConsentCheckbox";

export function CheckoutView({ shippingNote, testMode }: { shippingNote: string; testMode: boolean }) {
  const cart = useCart();
  const [form, setForm] = useState({ name: "", email: "", phone: "", address: "", note: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);

  if (cart.count === 0) {
    return (
      <div className="rounded-2xl border border-black/5 bg-white p-8 text-center shadow-sm">
        <p className="text-foreground/70">Tu carrito está vacío.</p>
        <a href="/tienda" className="mt-4 inline-flex items-center gap-2 font-semibold text-primary">
          <ArrowLeft size={16} /> Volver a la tienda
        </a>
      </div>
    );
  }

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function pay(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: cart.items.map((i) => ({ slug: i.slug, qty: i.qty })),
          buyer: form,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.url || !data?.token) {
        setError(data?.error ?? "No se pudo iniciar el pago. Intenta de nuevo.");
        setSubmitting(false);
        return;
      }
      // El carrito se limpia al volver aprobado; aquí solo redirigimos a Webpay.
      window.location.href = `${data.url}?token_ws=${encodeURIComponent(data.token)}`;
    } catch {
      setError("No se pudo iniciar el pago. Revisa tu conexión e intenta de nuevo.");
      setSubmitting(false);
    }
  }

  const inputCls =
    "w-full rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm text-foreground outline-none focus:border-primary";

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
      <form onSubmit={pay} className="order-2 space-y-4 lg:order-1">
        <h2 className="font-heading text-xl font-semibold text-foreground">Tus datos</h2>
        <input required placeholder="Nombre y apellido" value={form.name} onChange={set("name")} className={inputCls} />
        <input
          required
          type="email"
          placeholder="Email (te llega el comprobante)"
          value={form.email}
          onChange={set("email")}
          className={inputCls}
        />
        <input required placeholder="Teléfono / WhatsApp" value={form.phone} onChange={set("phone")} className={inputCls} />
        <input placeholder="Dirección de entrega (opcional si retiras)" value={form.address} onChange={set("address")} className={inputCls} />
        <textarea placeholder="Nota para el pedido (opcional)" value={form.note} onChange={set("note")} rows={3} className={inputCls} />
        <p className="text-xs text-foreground/60">{shippingNote}</p>
        {testMode ? (
          <p className="rounded-xl bg-amber-50 px-4 py-3 text-xs text-amber-800">
            Modo demo: el pago corre en el ambiente de prueba de Webpay — no se cobra dinero real. Tarjeta de
            prueba: VISA 4051 8856 0044 6623, CVV 123, cualquier fecha (RUT 11.111.111-1, clave 123).
          </p>
        ) : null}
        {error ? <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
        <ConsentCheckbox checked={consent} onChange={setConsent} id="checkout-consent" />
        <button
          type="submit"
          disabled={submitting || !consent}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 font-semibold text-white transition-colors hover:opacity-90 disabled:opacity-60"
        >
          {submitting ? <Loader2 size={18} className="animate-spin" /> : null}
          Pagar {formatCLP(cart.total)} con Webpay
        </button>
      </form>

      <aside className="order-1 h-fit rounded-2xl border border-black/5 bg-white p-6 shadow-sm lg:order-2">
        <h2 className="font-heading text-lg font-semibold text-foreground">Tu pedido</h2>
        <ul className="mt-4 divide-y divide-black/5">
          {cart.items.map((i) => (
            <li key={i.slug} className="flex items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{i.name}</p>
                <p className="text-xs text-foreground/60">
                  {i.qty} × {formatCLP(i.price)}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  aria-label={`Quitar uno de ${i.name}`}
                  onClick={() => cart.setQty(i.slug, i.qty - 1)}
                  className="rounded px-2 py-0.5 text-foreground/60 hover:bg-black/5"
                >
                  −
                </button>
                <span className="min-w-5 text-center text-sm">{i.qty}</span>
                <button
                  type="button"
                  aria-label={`Agregar uno de ${i.name}`}
                  onClick={() => cart.setQty(i.slug, i.qty + 1)}
                  className="rounded px-2 py-0.5 text-foreground/60 hover:bg-black/5"
                >
                  +
                </button>
                <button
                  type="button"
                  aria-label={`Eliminar ${i.name}`}
                  onClick={() => cart.remove(i.slug)}
                  className="ml-1 rounded p-1 text-foreground/40 hover:text-red-600"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex items-center justify-between border-t border-black/10 pt-4">
          <span className="text-sm text-foreground/70">Total</span>
          <span className="font-heading text-xl font-bold text-foreground">{formatCLP(cart.total)}</span>
        </div>
      </aside>
    </div>
  );
}
