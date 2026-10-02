"use client";

import { useEffect } from "react";

// En la página de confirmación: si el pago fue aprobado, vacía el carrito
// persistido para que el próximo pedido parta limpio.
export function ClearCartOnSuccess({ storageKey, paid }: { storageKey: string; paid: boolean }) {
  useEffect(() => {
    if (!paid) return;
    try {
      localStorage.removeItem(storageKey);
    } catch {
      // sin localStorage no hay nada que limpiar
    }
  }, [paid, storageKey]);
  return null;
}
