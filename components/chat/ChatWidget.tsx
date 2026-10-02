"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useState } from "react";
import { MessageCircle, X, Send } from "lucide-react";
import { ChatMarkdown } from "./ChatMarkdown";

function messageText(parts: { type: string; text?: string }[]): string {
  return parts
    .filter((p) => p.type === "text")
    .map((p) => p.text ?? "")
    .join("");
}

export function ChatWidget({
  businessName,
  stacked,
  actionButtons,
}: {
  businessName: string;
  stacked?: boolean;
  actionButtons?: { label: string; url: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const { messages, sendMessage, status, error, regenerate } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
  });
  const isLoading = status === "submitted" || status === "streaming";

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    sendMessage({ text: input });
    setInput("");
  }

  return (
    <div className={`fixed right-4 z-50 ${stacked ? "bottom-24" : "bottom-4"} sm:right-6`}>
      {open && (
        <div className="mb-3 flex h-[28rem] w-[20rem] flex-col overflow-hidden rounded-2xl border border-black/10 bg-background shadow-2xl sm:w-[22rem]">
          <div className="flex items-center justify-between bg-primary px-4 py-3 text-white">
            <span className="font-heading text-sm font-semibold">{businessName}</span>
            <button onClick={() => setOpen(false)} aria-label="Cerrar chat">
              <X size={18} />
            </button>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto px-3 py-3 text-sm">
            {messages.length === 0 && <p className="text-foreground/60">¡Hola! ¿En qué te puedo ayudar hoy?</p>}
            {messages.map((m) => {
              const text = messageText(m.parts);
              return (
                <div
                  key={m.id}
                  className={`max-w-[85%] rounded-xl px-3 py-2 ${
                    m.role === "user" ? "ml-auto bg-primary text-white" : "bg-black/5"
                  }`}
                >
                  {m.role === "user" ? text : <ChatMarkdown content={text} />}
                </div>
              );
            })}
            {isLoading && <p className="text-xs text-foreground/50">Escribiendo…</p>}
            {/* El modelo a veces corta la respuesta a mitad de camino (falla
                transitoria de Gemini) sin que el fetch en sí falle — sin este
                aviso, el chat queda con una respuesta truncada y sin
                explicación, como si estuviera roto. */}
            {error && !isLoading && (
              <div className="flex items-center justify-between gap-2 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">
                <span>La respuesta se cortó — intenta de nuevo.</span>
                <button onClick={() => regenerate()} className="shrink-0 font-semibold underline underline-offset-2">
                  Reintentar
                </button>
              </div>
            )}
          </div>
          {/* Siempre visibles (no solo tras una respuesta): mismo criterio que
              los botones del bot de Instagram — la persona nunca se queda sin
              un siguiente paso concreto al que ir. */}
          {actionButtons && actionButtons.length > 0 && (
            <div className="flex flex-wrap gap-1.5 border-t border-black/10 px-3 py-2">
              {actionButtons.map((b) => (
                <a
                  key={b.url}
                  href={b.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
                >
                  {b.label}
                </a>
              ))}
            </div>
          )}
          <form onSubmit={handleSubmit} className="flex items-center gap-2 border-t border-black/10 p-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Escribe tu mensaje…"
              aria-label="Mensaje"
              className="flex-1 rounded-full border border-black/10 px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <button type="submit" aria-label="Enviar" className="rounded-full bg-primary p-2 text-white">
              <Send size={16} />
            </button>
          </form>
        </div>
      )}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Cerrar chat" : "Abrir chat"}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white shadow-lg transition-transform active:scale-95"
      >
        {open ? <X size={24} /> : <MessageCircle size={24} />}
      </button>
    </div>
  );
}
