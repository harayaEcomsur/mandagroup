"use client";

import { ShoppingCart } from "lucide-react";
import { formatCLP } from "@/lib/clp";
import { useCart } from "./CartProvider";

// Barra fija inferior que aparece cuando hay productos en el carrito.
export function CartBar() {
  const cart = useCart();
  if (cart.count === 0) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-black/10 bg-white/95 backdrop-blur print:hidden">
      <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <p className="text-sm text-foreground/80">
        <span className="font-semibold">{cart.count}</span> {cart.count === 1 ? "producto" : "productos"} ·{" "}
          <span className="font-heading font-bold text-foreground">{formatCLP(cart.total)}</span>
        </p>
        <a
          href="/tienda/carrito"
          className="flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:opacity-90"
        >
          <ShoppingCart size={16} /> Ir a pagar
        </a>
      </div>
    </div>
  );
}
