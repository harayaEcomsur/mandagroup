"use client";

import { useEffect, useState } from "react";
import { CONSENT_EVENT, readConsent, saveConsent, type Consent } from "@/components/analytics/consent";

// Cambiar la decisión sobre la medición (Google Analytics y Pixel de Meta)
// sin tener que borrar los datos del sitio en el navegador.
export function ConsentToggle() {
  const [consent, setConsent] = useState<Consent | null | undefined>(undefined);

  useEffect(() => {
    setConsent(readConsent());
    const onConsent = (e: Event) => setConsent((e as CustomEvent<Consent>).detail);
    window.addEventListener(CONSENT_EVENT, onConsent);
    return () => window.removeEventListener(CONSENT_EVENT, onConsent);
  }, []);

  if (consent === undefined) return null;
  const denied = consent === "denied";

  return (
    <div className="flex flex-wrap items-center gap-3 text-sm text-foreground/75">
      <p>{denied ? "La medición del sitio está desactivada." : "La medición del sitio está activa."}</p>
      <button
        onClick={() => saveConsent(denied ? "granted" : "denied")}
        className="rounded-lg border border-foreground/20 px-4 py-2 font-medium text-foreground hover:bg-foreground/5"
      >
        {denied ? "Activar medición" : "Desactivar medición"}
      </button>
    </div>
  );
}
