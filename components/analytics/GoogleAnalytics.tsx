"use client";

import Script from "next/script";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { CONSENT_EVENT, CONSENT_KEY, isCarta, isInternal, type Consent } from "@/components/analytics/consent";

// Google Analytics 4 (NEXT_PUBLIC_GA_ID). Mide visitas, de dónde llegan
// (Google, Instagram, el QR de las mesas vía utm_*, IAs, etc.) y las acciones
// que importan. La venta y la reserva ocurren fuera del sitio (Vesti,
// WhatsApp), así que se mide el clic que lleva a ellas:
//   click_ticket   → link a la boletería de Vesti (evento, marca)
//   click_reserve  → WhatsApp / Instagram DM (canal, marca)
//   view_carta     → abrir una carta, PDF o Fudo (carta, marca)
//   click_call     → teléfono
//   click_maps     → cómo llegar (Google Maps)
//   click_social   → perfil de Instagram/TikTok/Facebook
//   open_chat      → abrir el asistente (components/chat/ChatWidget)
// Las vistas de página en la navegación del App Router, scroll, descargas y
// clics salientes los cubre la "medición mejorada" de GA4.
//
// Solo analítica: sin Google Signals ni señales de anuncios. Queda activa
// salvo que la persona la rechace (aviso de cookies o /privacidad); en ese
// caso Consent Mode deja de usar cookies.

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

function track(event: string, params: Record<string, string | undefined> = {}) {
  window.gtag?.("event", event, params);
}

function label(a: HTMLAnchorElement): string {
  return (a.getAttribute("aria-label") || a.textContent || "").trim().replace(/\s+/g, " ").slice(0, 100);
}

function cartaName(href: string): string {
  if (href.includes("menu.fu.do")) return "costa-sushi-online";
  return decodeURIComponent(href.split("?")[0].split("/").pop() ?? "").replace(/\.pdf$/i, "");
}

export function GoogleAnalytics({ id }: { id: string }) {
  const pathname = usePathname() ?? "/";

  // Paneles internos fuera de las estadísticas (también si se llega a ellos
  // navegando dentro del sitio).
  useEffect(() => {
    (window as unknown as Record<string, boolean>)[`ga-disable-${id}`] = isInternal(pathname);
  }, [id, pathname]);

  useEffect(() => {
    function onConsent(e: Event) {
      const value = (e as CustomEvent<Consent>).detail;
      window.gtag?.("consent", "update", { analytics_storage: value });
    }
    window.addEventListener(CONSENT_EVENT, onConsent);
    return () => window.removeEventListener(CONSENT_EVENT, onConsent);
  }, []);

  // Un solo listener para todo el sitio, igual que el Pixel: sin instrumentar
  // cada botón. data-pixel-brand / data-pixel-event ya marcan marca y evento.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      const a = (e.target as HTMLElement | null)?.closest?.("a");
      if (!a?.href) return;
      const href = a.href;
      const brand = a.dataset.pixelBrand || (href.includes("menu.fu.do") ? "costa" : undefined);
      const from = window.location.pathname;
      if (href.includes("vesti.cl")) {
        track("click_ticket", { event_title: a.dataset.pixelEvent ?? label(a), brand, link_url: href, from_page: from });
      } else if (href.includes("wa.me/") || href.includes("api.whatsapp.com")) {
        track("click_reserve", { method: "whatsapp", brand, from_page: from });
      } else if (href.includes("ig.me/")) {
        track("click_reserve", { method: "instagram_dm", brand, from_page: from });
      } else if (isCarta(href)) {
        track("view_carta", { carta: cartaName(href), brand, link_text: label(a), from_page: from });
      } else if (href.startsWith("tel:")) {
        track("click_call", { brand, from_page: from });
      } else if (/google\.[a-z.]+\/maps|maps\.app\.goo\.gl|goo\.gl\/maps/.test(href)) {
        track("click_maps", { place: label(a), brand, from_page: from });
      } else if (/instagram\.com|tiktok\.com|facebook\.com/.test(href)) {
        track("click_social", { network: new URL(href).hostname.replace("www.", ""), link_url: href, from_page: from });
      }
    }
    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, []);

  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${id}`} strategy="afterInteractive" />
      <Script id="ga4" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
window.gtag = gtag;
var p = location.pathname;
if (p.indexOf('/admin') !== -1 || p.indexOf('/embed') === 0) window['ga-disable-${id}'] = true;
var c = null; try { c = localStorage.getItem('${CONSENT_KEY}'); } catch (e) {}
gtag('consent', 'default', {
  analytics_storage: c === 'denied' ? 'denied' : 'granted',
  ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied'
});
gtag('js', new Date());
gtag('config', '${id}', { allow_google_signals: false, allow_ad_personalization_signals: false });`}
      </Script>
    </>
  );
}
