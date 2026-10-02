"use client";

import { useEffect, useState, useCallback } from "react";

type Venue = "renaca" | "vina";

interface MandagroupEvent {
  id: string;
  venue: Venue;
  title: string;
  ticketUrl: string;
  eventDate: string; // "YYYY-MM-DD"
  active: boolean;
  createdAt: string;
}

interface DerivationStats {
  total: number;
  porTipo: { reserva: number; invitacion: number };
  porVenue: Partial<Record<Venue, number>>;
  porCanal: { web: number; whatsapp: number; instagram: number };
  recientes: {
    canal: string;
    tipo: string;
    venue?: Venue;
    eventId?: string;
    eventTitle?: string;
    userMessage?: string;
    createdAt: string;
  }[];
}

interface ChatEntry {
  ts: number;
  canal: "web" | "whatsapp" | "instagram";
  userText: string;
  assistantText: string;
}

interface State {
  reservasWhatsapp: string | null;
  events: MandagroupEvent[];
  stats: DerivationStats;
  chats: ChatEntry[];
}

const VENUE_LABEL: Record<Venue, string> = { renaca: "Manda Reñaca", vina: "Manda Viña del Mar" };

// Panel de administración del módulo eventos: número de reservas, eventos
// activos (link de entradas editable) y estadísticas de derivaciones — mismo
// patrón fetch/PATCH que AdminAgenda.tsx contra app/api/eventos/route.ts.
export function AdminEventos({ adminKey }: { adminKey: string | null }) {
  const [state, setState] = useState<State | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [phoneDraft, setPhoneDraft] = useState("");
  const [newEvent, setNewEvent] = useState({ venue: "renaca" as Venue, title: "", ticketUrl: "", eventDate: "" });
  const [saving, setSaving] = useState(false);

  const headers = adminKey ? { "x-eventos-key": adminKey } : undefined;

  const load = useCallback(async () => {
    const res = await fetch("/api/eventos", { headers });
    if (!res.ok) {
      setError("No se pudo cargar el panel.");
      return;
    }
    const data = (await res.json()) as State;
    setState(data);
    setPhoneDraft(data.reservasWhatsapp ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminKey]);

  useEffect(() => {
    load();
  }, [load]);

  async function patch(body: Record<string, unknown>) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/eventos", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...(headers ?? {}) },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "No se pudo guardar.");
        return;
      }
      await load();
    } finally {
      setSaving(false);
    }
  }

  if (!state) return <p className="text-foreground/60">Cargando…</p>;

  return (
    <div className="space-y-10">
      {error && <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>}

      {/* Número de reservas */}
      <section className="rounded-2xl border border-foreground/10 p-6">
        <h2 className="font-heading text-lg font-semibold text-foreground">WhatsApp de reservas</h2>
        <p className="mt-1 text-sm text-foreground/60">
          El asistente entrega este número cuando alguien quiere reservar mesa/lista — cámbialo cuando cambie el
          anfitrión o el número de turno, sin depender de nadie más.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <input
            value={phoneDraft}
            onChange={(e) => setPhoneDraft(e.target.value)}
            placeholder="56912345678"
            className="w-56 rounded-lg border border-foreground/15 bg-background px-3 py-2 text-sm"
          />
          <button
            disabled={saving || !phoneDraft.trim()}
            onClick={() => patch({ action: "setReservationNumber", phone: phoneDraft.trim() })}
            className="rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            Guardar
          </button>
        </div>
      </section>

      {/* Eventos activos */}
      <section className="rounded-2xl border border-foreground/10 p-6">
        <h2 className="font-heading text-lg font-semibold text-foreground">Eventos y entradas</h2>
        <p className="mt-1 text-sm text-foreground/60">
          Cada evento tiene su propio link de entradas (Vesti u otra pasarela) — viernes y sábado pueden convivir
          activos al mismo tiempo, cada uno con su link.
        </p>

        <div className="mt-4 space-y-3">
          {state.events.length === 0 && <p className="text-sm text-foreground/50">Aún no hay eventos cargados.</p>}
          {state.events.map((ev) => (
            <div
              key={ev.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-foreground/10 px-4 py-3"
            >
              <div>
                <p className="font-medium text-foreground">
                  {ev.title} <span className="text-foreground/50">· {VENUE_LABEL[ev.venue]}</span>
                </p>
                <p className="text-xs text-foreground/50">
                  {new Date(ev.eventDate + "T12:00:00").toLocaleDateString("es-CL", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                  })}
                </p>
                <a href={ev.ticketUrl} target="_blank" rel="noreferrer" className="text-xs text-primary underline">
                  {ev.ticketUrl}
                </a>
              </div>
              <button
                disabled={saving}
                onClick={() => patch({ action: "setEventActive", id: ev.id, active: !ev.active })}
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  ev.active ? "bg-primary/15 text-primary" : "bg-foreground/10 text-foreground/50"
                }`}
              >
                {ev.active ? "Activo" : "Inactivo"}
              </button>
            </div>
          ))}
        </div>

        <div className="mt-6 grid gap-3 border-t border-foreground/10 pt-6 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_2fr_2fr_auto]">
          <select
            value={newEvent.venue}
            onChange={(e) => setNewEvent((v) => ({ ...v, venue: e.target.value as Venue }))}
            className="rounded-lg border border-foreground/15 bg-background px-3 py-2 text-sm"
          >
            <option value="renaca">Manda Reñaca</option>
            <option value="vina">Manda Viña del Mar</option>
          </select>
          <input
            type="date"
            value={newEvent.eventDate}
            onChange={(e) => setNewEvent((v) => ({ ...v, eventDate: e.target.value }))}
            className="rounded-lg border border-foreground/15 bg-background px-3 py-2 text-sm"
          />
          <input
            value={newEvent.title}
            onChange={(e) => setNewEvent((v) => ({ ...v, title: e.target.value }))}
            placeholder="Título (ej. Costa Nights)"
            className="rounded-lg border border-foreground/15 bg-background px-3 py-2 text-sm"
          />
          <input
            value={newEvent.ticketUrl}
            onChange={(e) => setNewEvent((v) => ({ ...v, ticketUrl: e.target.value }))}
            placeholder="Link de entradas (Vesti, etc.)"
            className="rounded-lg border border-foreground/15 bg-background px-3 py-2 text-sm"
          />
          <button
            disabled={saving || !newEvent.title.trim() || !newEvent.ticketUrl.trim() || !newEvent.eventDate}
            onClick={async () => {
              await patch({ action: "upsertEvent", ...newEvent });
              setNewEvent({ venue: "renaca", title: "", ticketUrl: "", eventDate: "" });
            }}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            Agregar
          </button>
        </div>
      </section>

      {/* Estadísticas (equivalente a ManyChat) */}
      <section className="rounded-2xl border border-foreground/10 p-6">
        <h2 className="font-heading text-lg font-semibold text-foreground">Estadísticas (últimos 30 días)</h2>
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Total derivaciones" value={state.stats.total} />
          <Stat label="Reservas" value={state.stats.porTipo.reserva} />
          <Stat label="Entradas" value={state.stats.porTipo.invitacion} />
          <Stat label="Por WhatsApp" value={state.stats.porCanal.whatsapp} />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Stat label="Reñaca" value={state.stats.porVenue.renaca ?? 0} />
          <Stat label="Viña del Mar" value={state.stats.porVenue.vina ?? 0} />
          <Stat label="Instagram + Web" value={state.stats.porCanal.instagram + state.stats.porCanal.web} />
        </div>

        <h3 className="mt-8 text-sm font-semibold text-foreground">Derivaciones recientes</h3>
        <p className="mt-1 text-xs text-foreground/50">Qué opción exacta eligió cada persona — no solo el conteo.</p>
        <div className="mt-2 max-h-72 overflow-y-auto rounded-lg border border-foreground/10">
          {state.stats.recientes.length === 0 ? (
            <p className="p-4 text-sm text-foreground/50">Sin derivaciones todavía.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <tbody>
                {state.stats.recientes.map((r, i) => (
                  <tr key={i} className="border-b border-foreground/5 last:border-0 align-top">
                    <td className="whitespace-nowrap px-3 py-2 text-foreground/50">
                      {new Date(r.createdAt).toLocaleString("es-CL")}
                    </td>
                    <td className="px-3 py-2 capitalize text-foreground">{r.canal}</td>
                    <td className="px-3 py-2 text-foreground">
                      {r.tipo === "reserva"
                        ? `Reserva · ${r.venue ? VENUE_LABEL[r.venue] : "—"}`
                        : `Entrada · ${r.eventTitle ?? "(evento eliminado)"}`}
                    </td>
                    <td className="px-3 py-2 text-foreground/60">{r.userMessage ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <h3 className="mt-8 text-sm font-semibold text-foreground">Conversaciones recientes (últimos 7 días)</h3>
        <p className="mt-1 text-xs text-foreground/50">
          El intercambio completo, no solo cuando termina en una derivación — para ver qué preguntan aunque no
          hayan reservado ni comprado nada.
        </p>
        <div className="mt-2 max-h-96 space-y-3 overflow-y-auto rounded-lg border border-foreground/10 p-3">
          {state.chats.length === 0 ? (
            <p className="p-1 text-sm text-foreground/50">Sin conversaciones todavía.</p>
          ) : (
            state.chats.map((c, i) => (
              <div key={i} className="rounded-lg border border-foreground/10 p-3 text-sm">
                <p className="text-xs text-foreground/40">
                  {new Date(c.ts).toLocaleString("es-CL")} · <span className="capitalize">{c.canal}</span>
                </p>
                <p className="mt-1 text-foreground">
                  <span className="font-semibold">Cliente:</span> {c.userText}
                </p>
                <p className="mt-1 text-foreground/70">
                  <span className="font-semibold">Asistente:</span> {c.assistantText}
                </p>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-foreground/10 p-4">
      <p className="text-2xl font-bold text-foreground">{value}</p>
      <p className="text-xs text-foreground/60">{label}</p>
    </div>
  );
}
