// Decisión de la persona sobre la medición del sitio, compartida por Google
// Analytics y el Pixel de Meta. Se guarda en localStorage y se avisa con un
// evento del navegador para que cada etiqueta reaccione sin recargar.

export type Consent = "granted" | "denied";

// Se mantiene el nombre original de la clave: quienes ya aceptaron o
// rechazaron el aviso del Pixel no vuelven a ver la pregunta.
export const CONSENT_KEY = "metaPixelConsent";
export const CONSENT_EVENT = "mg-consent-change";

// Paneles internos: no tiene sentido medir (ni mostrar el aviso) ahí.
export function isInternal(pathname: string): boolean {
  return pathname.includes("/admin") || pathname.startsWith("/embed");
}

export function readConsent(): Consent | null {
  try {
    const v = localStorage.getItem(CONSENT_KEY);
    return v === "granted" || v === "denied" ? v : null;
  } catch {
    // Modo privado / storage bloqueado: se vuelve a preguntar en cada visita.
    return null;
  }
}

export function saveConsent(value: Consent) {
  try {
    localStorage.setItem(CONSENT_KEY, value);
  } catch {
    // Sin storage la decisión vale solo para esta visita.
  }
  window.dispatchEvent(new CustomEvent<Consent>(CONSENT_EVENT, { detail: value }));
}

// Cartas: el lector (/carta/[id]), PDFs propios (/cartas/archivo/...) o la carta online de Costa Sushi.
export const isCarta = (href: string) => href.includes("menu.fu.do") || /\/cartas?\/[^/?#]|\.pdf($|\?)/i.test(href);
