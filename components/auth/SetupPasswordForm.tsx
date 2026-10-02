"use client";

import { useState } from "react";

// Primera contraseña de una cuenta invitada — dos caminos, a elección de la
// persona: escribir la suya, o generar una segura acá mismo en el navegador
// (nunca viaja a ningún servidor hasta que ella misma la confirma). Mismo
// molde de fetch que el resto de components/auth/*.
function generateSecurePassword(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*";
  const bytes = new Uint32Array(20);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (n) => alphabet[n % alphabet.length]).join("");
}

export function SetupPasswordForm({ token, email }: { token: string; email: string }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleGenerate() {
    const generated = generateSecurePassword();
    setPassword(generated);
    setConfirm(generated);
    setRevealed(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) return setError("La contraseña debe tener al menos 8 caracteres.");
    if (password !== confirm) return setError("Las dos contraseñas no coinciden.");

    setLoading(true);
    try {
      const res = await fetch("/api/auth/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      if (res.ok) {
        window.location.href = "/eventos/admin";
        return;
      }
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "No se pudo crear la contraseña.");
    } catch {
      setError("No se pudo contactar al servidor.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full flex-col gap-3 text-left">
      <p className="text-center text-sm text-foreground/60">
        Cuenta: <span className="font-semibold text-foreground">{email}</span>
      </p>

      <div>
        <label className="text-xs font-semibold uppercase tracking-wider text-foreground/50">Contraseña</label>
        <input
          type={revealed ? "text" : "password"}
          autoComplete="new-password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setRevealed(false);
          }}
          placeholder="Mínimo 8 caracteres"
          className="mt-1 w-full rounded-lg border border-foreground/20 bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
        />
      </div>

      <div>
        <label className="text-xs font-semibold uppercase tracking-wider text-foreground/50">Repetir contraseña</label>
        <input
          type={revealed ? "text" : "password"}
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Escríbela de nuevo"
          className="mt-1 w-full rounded-lg border border-foreground/20 bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
        />
      </div>

      <button
        type="button"
        onClick={handleGenerate}
        className="rounded-lg border border-foreground/20 px-4 py-2 text-xs font-semibold text-foreground hover:border-primary"
      >
        Generar una contraseña segura
      </button>
      {revealed && password && (
        <p className="rounded-lg bg-primary/10 px-3 py-2 text-xs text-foreground/70">
          Guárdala ahora en un lugar seguro (gestor de contraseñas) — no se vuelve a mostrar.
        </p>
      )}

      <button
        type="submit"
        disabled={loading || !password || !confirm}
        className="mt-1 w-full rounded-lg bg-primary px-4 py-2 text-xs font-bold uppercase tracking-wider text-white transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {loading ? "…" : "Crear contraseña y entrar"}
      </button>
      {error && <p className="text-center text-xs font-semibold text-red-600">{error}</p>}
    </form>
  );
}
