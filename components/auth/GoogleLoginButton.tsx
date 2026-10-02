"use client";

import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: { client_id: string; callback: (resp: { credential: string }) => void }) => void;
          renderButton: (parent: HTMLElement, options: { theme: string; size: string; text: string }) => void;
        };
      };
    };
  }
}

// Carga Google Identity Services y renderiza el botón "Iniciar sesión con
// Google". Al completar, manda el id_token a `endpoint` (default /api/auth/google
// para Agenda; el panel inmobiliario pasa /api/auth/google-re) — si el correo
// está en la allowlist correspondiente, el servidor deja la sesión en una
// cookie y recargamos para que el server component del panel vuelva a evaluar
// el acceso.
export function GoogleLoginButton({ clientId, endpoint = "/api/auth/google" }: { clientId: string; endpoint?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    const scriptId = "google-identity-services";
    function init() {
      if (!window.google || !ref.current) return;
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async (resp) => {
          setChecking(true);
          setError(null);
          try {
            const r = await fetch(endpoint, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ credential: resp.credential }),
            });
            const data = await r.json();
            if (!r.ok) {
              setError(data.error ?? "No se pudo iniciar sesión.");
              setChecking(false);
              return;
            }
            window.location.reload();
          } catch {
            setError("No se pudo contactar al servidor.");
            setChecking(false);
          }
        },
      });
      window.google.accounts.id.renderButton(ref.current, { theme: "outline", size: "large", text: "signin_with" });
    }

    if (window.google) {
      init();
      return;
    }
    if (document.getElementById(scriptId)) return;
    const script = document.createElement("script");
    script.id = scriptId;
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = init;
    document.body.appendChild(script);
  }, [clientId, endpoint]);

  return (
    <div className="flex flex-col items-start gap-2">
      <div ref={ref} />
      {checking && <p className="text-sm text-foreground/60">Verificando…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
