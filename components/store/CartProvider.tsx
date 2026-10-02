"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

export interface CartItem {
  slug: string;
  name: string;
  price: number;
  qty: number;
  imageUrl?: string;
}

interface CartApi {
  items: CartItem[];
  add: (item: Omit<CartItem, "qty">) => void;
  setQty: (slug: string, qty: number) => void;
  remove: (slug: string) => void;
  clear: () => void;
  count: number;
  total: number;
}

const CartContext = createContext<CartApi | null>(null);

export function CartProvider({ storageKey, children }: { storageKey: string; children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  // El carrito vive en localStorage: sobrevive navegación y recargas sin backend.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) setItems(JSON.parse(raw));
    } catch {
      // localStorage no disponible o corrupto: se parte con carrito vacío.
    }
    setLoaded(true);
  }, [storageKey]);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(items));
    } catch {
      // sin persistencia; el carrito sigue funcionando en memoria
    }
  }, [items, loaded, storageKey]);

  const api = useMemo<CartApi>(() => {
    const setQty = (slug: string, qty: number) =>
      setItems((prev) =>
        qty <= 0
          ? prev.filter((i) => i.slug !== slug)
          : prev.map((i) => (i.slug === slug ? { ...i, qty: Math.min(qty, 99) } : i))
      );
    return {
      items,
      add: (item) =>
        setItems((prev) => {
          const existing = prev.find((i) => i.slug === item.slug);
          if (existing) {
            return prev.map((i) => (i.slug === item.slug ? { ...i, qty: Math.min(i.qty + 1, 99) } : i));
          }
          return [...prev, { ...item, qty: 1 }];
        }),
      setQty,
      remove: (slug) => setItems((prev) => prev.filter((i) => i.slug !== slug)),
      clear: () => setItems([]),
      count: items.reduce((n, i) => n + i.qty, 0),
      total: items.reduce((n, i) => n + i.price * i.qty, 0),
    };
  }, [items]);

  return <CartContext.Provider value={api}>{children}</CartContext.Provider>;
}

export function useCart(): CartApi {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart debe usarse dentro de <CartProvider>");
  return ctx;
}
