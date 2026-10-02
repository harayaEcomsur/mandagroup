"use client";

import { Minus, Plus, ShoppingBag } from "lucide-react";
import { formatCLP } from "@/lib/clp";
import { useCart } from "./CartProvider";

export interface StoreProduct {
  slug: string;
  name: string;
  price: number;
  description: string;
  imageUrl?: string;
  category?: string;
}

export function ProductCard({ product }: { product: StoreProduct }) {
  const cart = useCart();
  const inCart = cart.items.find((i) => i.slug === product.slug);

  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-black/5 bg-white shadow-sm">
      {product.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- imágenes del config (locales o remotas)
        <img src={product.imageUrl} alt={product.name} className="h-44 w-full object-cover" />
      ) : (
        <div className="flex h-44 w-full items-center justify-center bg-primary/5 text-primary/40">
          <ShoppingBag size={40} />
        </div>
      )}
      <div className="flex flex-1 flex-col p-5">
        {product.category ? (
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary/70">{product.category}</p>
        ) : null}
        <h3 className="mt-1 font-heading text-lg font-semibold text-foreground">{product.name}</h3>
        <p className="mt-1 flex-1 text-sm text-foreground/70">{product.description}</p>
        <div className="mt-4 flex items-center justify-between gap-3">
          <span className="font-heading text-lg font-bold text-foreground">{formatCLP(product.price)}</span>
          {inCart ? (
            <div className="flex items-center gap-2 rounded-full border border-primary/30 px-2 py-1">
              <button
                aria-label={`Quitar uno de ${product.name}`}
                onClick={() => cart.setQty(product.slug, inCart.qty - 1)}
                className="rounded-full p-1 text-primary hover:bg-primary/10"
              >
                <Minus size={16} />
              </button>
              <span className="min-w-5 text-center text-sm font-semibold">{inCart.qty}</span>
              <button
                aria-label={`Agregar uno de ${product.name}`}
                onClick={() => cart.setQty(product.slug, inCart.qty + 1)}
                className="rounded-full p-1 text-primary hover:bg-primary/10"
              >
                <Plus size={16} />
              </button>
            </div>
          ) : (
            <button
              onClick={() =>
                cart.add({ slug: product.slug, name: product.name, price: product.price, imageUrl: product.imageUrl })
              }
              className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:opacity-90"
            >
              Agregar
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
