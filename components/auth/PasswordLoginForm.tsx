"use client";

import { useState } from "react";

// Login propio (usuario o correo + contraseña) — alternativa a Google y a la
// clave compartida, ver lib/admin-users-store.ts. Mismo molde que
// ClaveLoginForm.tsx: intercambia las credenciales por una cookie real en el
// servidor, nada de secretos viajando por la URL.
export function PasswordLoginForm({ endpoint = "/api/auth/password" }: { endpoint?: string }) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
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
        body: JSON.stringify({ identifier, password }),
      });
      if (res.ok) {
        window.location.href = window.location.pathname;
        return;
      }
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Usuario/correo o contraseña incorrectos.");
    } catch {
      setError("No se pudo contactar al servidor.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full flex-col gap-2">
      <input
        type="text"
        autoComplete="username"
        value={identifier}
        onChange={(e) => setIdentifier(e.target.value)}
        placeholder="Usuario o correo"
        className="w-full rounded-lg border border-foreground/20 bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
      />
      <input
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Contraseña"
        className="w-full rounded-lg border border-foreground/20 bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
      />
      <button
        type="submit"
        disabled={loading || !identifier || !password}
        className="w-full rounded-lg bg-primary px-4 py-2 text-xs font-bold uppercase tracking-wider text-white transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {loading ? "…" : "Entrar"}
      </button>
      {error && <p className="text-xs font-semibold text-red-600">{error}</p>}
    </form>
  );
}
