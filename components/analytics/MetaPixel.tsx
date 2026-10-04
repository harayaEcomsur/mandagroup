"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

// Pixel de Meta (opcional, solo si el sitio define NEXT_PUBLIC_META_PIXEL_ID).
// La venta de entradas ocurre fuera del sitio (Vesti), así que el Pixel no ve
// la compra: lo que sí mide es la intención — el clic a la boletería se
// registra como InitiateCheckout y el clic a WhatsApp como Contact. Con eso
// Meta puede optimizar anuncios por "personas que van a comprar" y armar
// públicos de retargeting de quienes visitaron el sitio.
//
// Ley 21.719: el Pixel comparte datos de navegación con Meta para publicidad,
// así que NO se carga hasta que la persona acepta en el aviso — rechazar (o
// no contestar) deja el sitio funcionando igual, sin Pixel.

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    _fbq?: unknown;
  }
}

const CONSENT_KEY = "metaPixelConsent"; // "granted" | "denied"

// Paneles internos: no tiene sentido medir (ni mostrar el aviso) ahí.
function isInternal(pathname: string): boolean {
  return pathname.includes("/admin") || pathname.startsWith("/embed");
}

function readConsent(): string | null {
  try {
    return localStorage.getItem(CONSENT_KEY);
  } catch {
    // Modo privado / storage bloqueado: se vuelve a preguntar en cada visita.
    return null;
  }
}

function saveConsent(value: "granted" | "denied") {
  try {
    localStorage.setItem(CONSENT_KEY, value);
  } catch {
    // Sin storage la decisión vale solo para esta visita.
  }
}

// Snippet oficial de Meta (fbevents.js), sin el <noscript>: sin JS no hay
// aviso de consentimiento que aceptar, así que tampoco hay Pixel.
function loadPixel(pixelId: string) {
  if (window.fbq) return;
  const fbq = function (...args: unknown[]) {
    const f = fbq as unknown as { callMethod?: (...a: unknown[]) => void; queue: unknown[] };
    if (f.callMethod) f.callMethod(...args);
    else f.queue.push(args);
  } as unknown as Window["fbq"] & { push: unknown; loaded: boolean; version: string; queue: unknown[] };
  fbq.push = fbq;
  fbq.loaded = true;
  fbq.version = "2.0";
  fbq.queue = [];
  window.fbq = fbq;
  window._fbq = fbq;
  const script = document.createElement("script");
  script.async = true;
  script.src = "https://connect.facebook.net/en_US/fbevents.js";
  document.head.appendChild(script);
  window.fbq("init", pixelId);
}

export function MetaPixel({ pixelId }: { pixelId: string }) {
  const pathname = usePathname() ?? "/";
  const [consent, setConsent] = useState<string | null>(null);
  const [ready, setReady] = useState(false); // evita mostrar el aviso antes de leer localStorage

  useEffect(() => {
    setConsent(readConsent());
    setReady(true);
  }, []);

  const active = consent === "granted" && !isInternal(pathname);

  // PageView en cada navegación (el App Router no recarga la página).
  useEffect(() => {
    if (!active) return;
    loadPixel(pixelId);
    window.fbq?.("track", "PageView");
  }, [active, pixelId, pathname]);

  // Un solo listener para todo el sitio: cualquier link a la boletería o a
  // WhatsApp — tarjetas de eventos, botones del chat, footer — sin tener que
  // instrumentar cada componente.
  useEffect(() => {
    if (!active) return;
    function onClick(e: MouseEvent) {
      const a = (e.target as HTMLElement | null)?.closest?.("a");
      if (!a?.href) return;
      if (a.href.includes("vesti.cl")) {
        window.fbq?.("track", "InitiateCheckout", {
          content_name: a.dataset.pixelEvent ?? a.textContent?.trim() ?? "",
          content_category: "entradas",
        });
      } else if (a.href.includes("wa.me/") || a.href.includes("api.whatsapp.com")) {
        window.fbq?.("track", "Contact");
      }
    }
    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, [active]);

  if (!ready || consent || isInternal(pathname)) return null;

  return (
    <div
      role="dialog"
      aria-label="Aviso de cookies"
      className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-lg rounded-2xl border border-foreground/10 bg-background p-4 text-sm text-foreground/80 shadow-xl sm:p-5"
    >
      <p>
        Usamos el Pixel de Meta para medir qué publicaciones te trajeron y mostrarte nuestros eventos en Instagram y
        Facebook. Solo se activa si aceptas.{" "}
        <a href="/privacidad" className="underline underline-offset-2">
          Más info
        </a>
      </p>
      <div className="mt-3 flex justify-end gap-2">
        <button
          onClick={() => {
            saveConsent("denied");
            setConsent("denied");
          }}
          className="rounded-lg border border-foreground/20 px-4 py-2 font-medium text-foreground hover:bg-foreground/5"
        >
          Rechazar
        </button>
        <button
          onClick={() => {
            saveConsent("granted");
            setConsent("granted");
          }}
          className="rounded-lg bg-primary px-4 py-2 font-semibold text-background hover:opacity-90"
        >
          Aceptar
        </button>
      </div>
    </div>
  );
}
