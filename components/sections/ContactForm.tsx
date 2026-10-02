"use client";

import { useState } from "react";
import { ConsentCheckbox } from "@/components/privacy/ConsentCheckbox";

export function ContactForm() {
  const [status, setStatus] = useState<"idle" | "sending" | "ok" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [consent, setConsent] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("sending");
    const form = e.currentTarget;
    const data = new FormData(form);
    const payload = {
      name: String(data.get("name") ?? ""),
      contactInfo: String(data.get("contactInfo") ?? ""),
      message: String(data.get("message") ?? ""),
    };

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const responseData = await res.json();

      if (!res.ok) {
        setStatus("error");
        setErrorMsg(responseData.error ?? "Ocurrió un error.");
        return;
      }

      setStatus("ok");
      form.reset();
    } catch {
      setStatus("error");
      setErrorMsg("No se pudo enviar el mensaje. Revisa tu conexión.");
    }
  }

  if (status === "ok") {
    return (
      <p className="rounded-xl bg-primary/10 p-4 text-primary">
        ¡Gracias! Te responderemos a la brevedad.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="name" className="mb-1 block text-sm font-medium text-foreground">
          Nombre
        </label>
        <input
          id="name"
          name="name"
          required
          className="w-full rounded-lg border border-black/10 px-3 py-2 focus:border-primary focus:outline-none"
        />
      </div>
      <div>
        <label htmlFor="contactInfo" className="mb-1 block text-sm font-medium text-foreground">
          Teléfono o email
        </label>
        <input
          id="contactInfo"
          name="contactInfo"
          required
          className="w-full rounded-lg border border-black/10 px-3 py-2 focus:border-primary focus:outline-none"
        />
      </div>
      <div>
        <label htmlFor="message" className="mb-1 block text-sm font-medium text-foreground">
          Mensaje
        </label>
        <textarea
          id="message"
          name="message"
          required
          rows={4}
          className="w-full rounded-lg border border-black/10 px-3 py-2 focus:border-primary focus:outline-none"
        />
      </div>
      <ConsentCheckbox checked={consent} onChange={setConsent} id="contact-consent" />
      <button
        type="submit"
        disabled={status === "sending" || !consent}
        className="rounded-full bg-primary px-6 py-3 font-medium text-white disabled:opacity-60"
      >
        {status === "sending" ? "Enviando…" : "Enviar mensaje"}
      </button>
      {status === "error" && <p className="text-sm text-red-600">{errorMsg}</p>}
    </form>
  );
}
