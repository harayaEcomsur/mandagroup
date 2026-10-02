"use client";

import { useState } from "react";

// Reemplaza el viejo "pega ?clave=... en la URL": la clave se escribe una
// sola vez acá, el servidor la cambia por una cookie real (/api/auth/clave) y
// desde ahí la URL queda limpia — nunca más un secreto visible en el
// historial del navegador. `endpoint` es configurable a propósito para que
// tienda/inmobiliaria puedan reusar este mismo componente con su propia ruta.
export function ClaveLoginForm({ endpoint = "/api/auth/clave" }: { endpoint?: string }) {
  const [clave, setClave] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clave }),
      });
      if (res.ok) {
        // Ruta limpia, sin importar con qué query se haya llegado a esta página.
        window.location.href = window.location.pathname;
        return;
      }
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Clave incorrecta.");
    } catch {
      setError("No se pudo contactar al servidor.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full flex-col gap-2">
      <div className="flex gap-2">
        <input
          type="password"
          autoComplete="current-password"
          value={clave}
          onChange={(e) => setClave(e.target.value)}
          placeholder="Clave de administración"
          className="min-w-0 flex-1 rounded-lg border border-foreground/20 bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
        />
        <button
          type="submit"
          disabled={loading || !clave}
          className="shrink-0 rounded-lg bg-primary px-4 py-2 text-xs font-bold uppercase tracking-wider text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {loading ? "…" : "Entrar"}
        </button>
      </div>
      {error && <p className="text-xs font-semibold text-red-600">{error}</p>}
    </form>
  );
}
