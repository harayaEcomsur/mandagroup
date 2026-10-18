"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { PIXEL_BRANDS, type PixelBrand } from "@/lib/mandagroup-pixel";
import { CONSENT_EVENT, isCarta, isInternal, readConsent, saveConsent, type Consent } from "@/components/analytics/consent";

export interface MetaPixels {
  group?: string;
  brands: Partial<Record<PixelBrand, string>>;
}

// Pixeles de Meta (opcionales): uno general del grupo (NEXT_PUBLIC_META_PIXEL_ID)
// y, si existen, uno por marca (Reñaca, Viña, Carbon, Costa Sushi). Todos
// reciben las visitas (PageView), así cada marca puede mostrarle anuncios a
// quien pasó por el sitio; cada acción va al general y al de su marca
// (data-pixel-brand en el enlace, ver lib/mandagroup-pixel).
//
// La venta de entradas ocurre fuera del sitio (Vesti), así que el Pixel no ve
// la compra: lo que sí mide es la intención — el clic a la boletería se
// registra como InitiateCheckout, el clic a reservar (WhatsApp/Instagram)
// como Contact y abrir una carta como ViewContent. Con eso
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

// Snippet oficial de Meta (fbevents.js), sin el <noscript>: sin JS no hay
// aviso de consentimiento que aceptar, así que tampoco hay Pixel.
function loadPixel(pixelIds: string[]) {
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
  for (const id of pixelIds) window.fbq("init", id);
}

function allIds(p: MetaPixels): string[] {
  return Array.from(new Set([p.group, ...PIXEL_BRANDS.map((b) => p.brands[b])].filter(Boolean) as string[]));
}

// La acción va al general y al Pixel de su marca (si tiene); trackSingle
// para que no llegue también a los de las otras marcas.
function trackAction(p: MetaPixels, brand: string | undefined, event: string, params?: Record<string, string>) {
  const own = brand && PIXEL_BRANDS.includes(brand as PixelBrand) ? p.brands[brand as PixelBrand] : undefined;
  for (const id of new Set([p.group, own].filter(Boolean) as string[])) {
    window.fbq?.("trackSingle", id, event, { ...params, ...(brand ? { brand } : {}) });
  }
}

export function MetaPixel({ pixels }: { pixels: MetaPixels }) {
  const pathname = usePathname() ?? "/";
  const [consent, setConsent] = useState<string | null>(null);
  const [ready, setReady] = useState(false); // evita mostrar el aviso antes de leer localStorage

  useEffect(() => {
    setConsent(readConsent());
    setReady(true);
    // La decisión también puede cambiar desde /privacidad.
    const onConsent = (e: Event) => setConsent((e as CustomEvent<Consent>).detail);
    window.addEventListener(CONSENT_EVENT, onConsent);
    return () => window.removeEventListener(CONSENT_EVENT, onConsent);
  }, []);

  const active = consent === "granted" && !isInternal(pathname);

  // PageView en cada navegación (el App Router no recarga la página).
  useEffect(() => {
    if (!active) return;
    loadPixel(allIds(pixels));
    window.fbq?.("track", "PageView");
  }, [active, pixels, pathname]);

  // Un solo listener para todo el sitio: cualquier link a la boletería o a
  // WhatsApp — tarjetas de eventos, botones del chat, footer — sin tener que
  // instrumentar cada componente.
  useEffect(() => {
    if (!active) return;
    function onClick(e: MouseEvent) {
      const a = (e.target as HTMLElement | null)?.closest?.("a");
      if (!a?.href) return;
      const brand = a.dataset.pixelBrand || (a.href.includes("menu.fu.do") ? "costa" : undefined);
      if (a.href.includes("vesti.cl")) {
        trackAction(pixels, brand, "InitiateCheckout", {
          content_name: a.dataset.pixelEvent ?? a.textContent?.trim() ?? "",
          content_category: "entradas",
        });
      } else if (a.href.includes("wa.me/") || a.href.includes("api.whatsapp.com") || a.href.includes("ig.me/")) {
        trackAction(pixels, brand, "Contact");
      } else if (isCarta(a.href)) {
        trackAction(pixels, brand, "ViewContent", { content_category: "carta" });
      }
    }
    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, [active, pixels]);

  if (!ready || consent || isInternal(pathname)) return null;

  return (
    <div
      role="dialog"
      aria-label="Aviso de cookies"
      className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-lg rounded-2xl border border-foreground/10 bg-background p-4 text-sm text-foreground/80 shadow-xl sm:p-5"
    >
      <p>
        Usamos el Pixel de Meta para medir qué publicaciones te trajeron y mostrarte nuestros eventos en Instagram y
        Facebook (solo si aceptas), y Google Analytics para saber cómo se usa el sitio (si rechazas, deja de usar
        cookies).{" "}
        <a href="/privacidad" className="underline underline-offset-2">
          Más info
        </a>
      </p>
      <div className="mt-3 flex justify-end gap-2">
        <button
          onClick={() => saveConsent("denied")}
          className="rounded-lg border border-foreground/20 px-4 py-2 font-medium text-foreground hover:bg-foreground/5"
        >
          Rechazar
        </button>
        <button
          onClick={() => saveConsent("granted")}
          className="rounded-lg bg-primary px-4 py-2 font-semibold text-background hover:opacity-90"
        >
          Aceptar
        </button>
      </div>
    </div>
  );
}
