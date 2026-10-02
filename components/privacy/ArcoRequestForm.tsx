"use client";

import { useState } from "react";

const TIPOS = [
  { value: "acceso", label: "Acceso a mis datos" },
  { value: "rectificacion", label: "Corregir mis datos" },
  { value: "cancelacion", label: "Eliminar mis datos" },
  { value: "oposicion", label: "Oponerme al tratamiento" },
  { value: "portabilidad", label: "Recibir una copia (portabilidad)" },
  { value: "bloqueo", label: "Bloquear temporalmente mis datos" },
] as const;

export function ArcoRequestForm() {
  const [tipo, setTipo] = useState<(typeof TIPOS)[number]["value"]>("acceso");
  const [nombre, setNombre] = useState("");
  const [contacto, setContacto] = useState("");
  const [detalle, setDetalle] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    try {
      const res = await fetch("/api/privacidad/solicitud", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo, nombre, contacto, detalle: detalle || undefined }),
      });
      if (!res.ok) throw new Error();
      setStatus("sent");
      setNombre("");
      setContacto("");
      setDetalle("");
    } catch {
      setStatus("error");
    }
  }

  if (status === "sent") {
    return (
      <p className="rounded-xl border border-foreground/15 bg-foreground/5 p-4 text-foreground/80">
        Recibimos tu solicitud. Te responderemos dentro de los próximos 30 días al contacto que dejaste.
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 rounded-xl border border-foreground/15 p-4 sm:p-5">
      <select
        className="w-full rounded-lg border border-foreground/20 bg-background px-3 py-2 text-sm"
        value={tipo}
        onChange={(e) => setTipo(e.target.value as (typeof TIPOS)[number]["value"])}
      >
        {TIPOS.map((t) => (
          <option key={t.value} value={t.value}>
            {t.label}
          </option>
        ))}
      </select>
      <input
        className="w-full rounded-lg border border-foreground/20 bg-background px-3 py-2 text-sm"
        placeholder="Tu nombre"
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        required
      />
      <input
        className="w-full rounded-lg border border-foreground/20 bg-background px-3 py-2 text-sm"
        placeholder="Tu correo o teléfono, para responderte"
        value={contacto}
        onChange={(e) => setContacto(e.target.value)}
        required
      />
      <textarea
        className="w-full rounded-lg border border-foreground/20 bg-background px-3 py-2 text-sm"
        placeholder="Detalle (opcional)"
        rows={3}
        value={detalle}
        onChange={(e) => setDetalle(e.target.value)}
      />
      <button
        type="submit"
        disabled={status === "sending" || !nombre || !contacto}
        className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
      >
        {status === "sending" ? "Enviando…" : "Enviar solicitud"}
      </button>
      {status === "error" && <p className="text-sm text-red-600">No se pudo enviar. Intenta de nuevo o escríbenos directamente.</p>}
    </form>
  );
}
