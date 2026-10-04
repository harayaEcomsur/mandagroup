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

interface InstagramScope {
  enabled: boolean;
  venues: Venue[];
  allowReservations: boolean;
}

interface PausedThread {
  senderId: string;
  pausedUntil: string;
  lastUserMessage: string | null;
}

interface VestiEvent {
  vestiId: string;
  venue: Venue;
  name: string;
  startsAt: string;
  eventDate: string;
  imageUrl: string | null;
  url: string;
  lowestPrice: number | null;
}

interface State {
  reservasWhatsapp: string | null;
  events: MandagroupEvent[];
  stats: DerivationStats;
  chats: ChatEntry[];
  instagramScopes: Record<string, InstagramScope>;
  instagramAccounts: Record<string, string>;
  pausedThreads: PausedThread[];
  vestiEvents: VestiEvent[];
  hiddenVesti: string[];
}

const VENUE_LABEL: Record<Venue, string> = { renaca: "Manda Reñaca", vina: "Manda Viña del Mar" };

// Cuentas reales de Instagram de este cliente (mismos IDs que
// config/client.config.ts → instagramAccounts) — solo para mostrar un nombre
// reconocible en vez del ID numérico crudo.
const IG_ACCOUNT_LABEL: Record<string, string> = {
  "17841462428914603": "@manda.chile (Reñaca)",
  "17841421479976537": "@mandavina.cl (Viña del Mar)",
};

// Biblioteca de anuncios de Meta: pública, sin login — la forma confiable de
// ver qué publicidad pagada está corriendo, porque Meta no le muestra los
// anuncios a quien no calza con la segmentación (típicamente el dueño).
const AD_LIBRARY = (q: string) =>
  `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=CL&media_type=all&search_type=keyword_unordered&q=${encodeURIComponent(q)}`;

const UNRESTRICTED: InstagramScope = { enabled: true, venues: ["renaca", "vina"], allowReservations: true };

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

      {/* Eventos importados de Vesti: se publican solos (sitio + asistente);
          acá solo se ocultan los que no deban salir. */}
      <section className="rounded-2xl border border-foreground/10 p-6">
        <h2 className="font-heading text-lg font-semibold text-foreground">Eventos desde Vesti</h2>
        <p className="mt-1 text-sm text-foreground/60">
          Todo evento futuro publicado en Vesti para Manda Reñaca o Manda Viña aparece solo en el sitio y lo ofrece el
          asistente. Se actualiza cada 15 minutos. Oculta los que no quieras mostrar.
        </p>
        <div className="mt-4 space-y-3">
          {state.vestiEvents.length === 0 && (
            <p className="text-sm text-foreground/50">No hay eventos próximos en Vesti (o Vesti no respondió).</p>
          )}
          {state.vestiEvents.map((ev) => {
            const hidden = state.hiddenVesti.includes(ev.vestiId);
            return (
              <div
                key={ev.vestiId}
                className={`flex items-center gap-4 rounded-lg border border-foreground/10 px-4 py-3 ${hidden ? "opacity-60" : ""}`}
              >
                {ev.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element -- flyer remoto de Vesti, miniatura del panel
                  <img src={ev.imageUrl} alt="" className="h-14 w-14 shrink-0 rounded-md object-cover" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-foreground">{ev.name}</p>
                  <p className="text-xs text-foreground/50">
                    {VENUE_LABEL[ev.venue]} ·{" "}
                    {new Date(ev.eventDate + "T12:00:00").toLocaleDateString("es-CL", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                    })}
                  </p>
                  <a href={ev.url} target="_blank" rel="noreferrer" className="text-xs text-primary underline">
                    Ver en Vesti
                  </a>
                </div>
                <button
                  disabled={saving}
                  onClick={() => patch({ action: "setVestiHidden", vestiId: ev.vestiId, hidden: !hidden })}
                  className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
                    hidden ? "bg-foreground/10 text-foreground/60" : "bg-primary/15 text-primary"
                  }`}
                >
                  {hidden ? "Oculto" : "Visible"}
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* Publicidad pagada en Meta */}
      <section className="rounded-2xl border border-foreground/10 p-6">
        <h2 className="font-heading text-lg font-semibold text-foreground">Anuncios activos en Meta</h2>
        <p className="mt-1 text-sm text-foreground/60">
          Meta solo muestra cada anuncio al público al que va dirigido, por eso es normal no verlos en tu propio feed.
          Aquí ves todos los que están corriendo ahora, tal como los ve la gente.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          {["Manda Viña", "Manda Reñaca", "Manda Group"].map((q) => (
            <a
              key={q}
              href={AD_LIBRARY(q)}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-foreground/15 px-4 py-2 text-sm font-semibold text-foreground hover:border-primary hover:text-primary"
            >
              Ver anuncios de {q}
            </a>
          ))}
        </div>
      </section>

      {/* Alcance por cuenta de Instagram — acota qué local(es) y si ofrece
          reservas, por si una cuenta (ej. @mandavina.cl) debe responder solo
          de su propio local, sin mencionar el otro ni derivar reservas. */}
      <section className="rounded-2xl border border-foreground/10 p-6">
        <h2 className="font-heading text-lg font-semibold text-foreground">Instagram por cuenta</h2>
        <p className="mt-1 text-sm text-foreground/60">
          Sin tocar nada acá, cada cuenta responde de ambos locales y ofrece reservas — normal. Acótala solo si
          quieres que una cuenta puntual hable nada más que de su propio local.
        </p>
        <div className="mt-4 space-y-4">
          {Object.keys(state.instagramAccounts).length === 0 ? (
            <p className="text-sm text-foreground/50">No hay cuentas de Instagram configuradas.</p>
          ) : (
            Object.keys(state.instagramAccounts).map((igAccountId) => (
              <InstagramScopeRow
                key={igAccountId}
                igAccountId={igAccountId}
                label={IG_ACCOUNT_LABEL[igAccountId] ?? igAccountId}
                initial={state.instagramScopes[igAccountId] ?? UNRESTRICTED}
                saving={saving}
                onSave={(scope) => patch({ action: "setInstagramScope", igAccountId, ...scope })}
              />
            ))
          )}
        </div>
      </section>

      {/* Conversaciones pausadas por toma de control humano — cuando alguien
          del equipo responde a mano desde la app, el bot se pausa 6h solo
          para no pisarle la respuesta. Reanudar acá corta esa pausa antes. */}
      <section className="rounded-2xl border border-foreground/10 p-6">
        <h2 className="font-heading text-lg font-semibold text-foreground">Conversaciones pausadas (Instagram)</h2>
        <p className="mt-1 text-sm text-foreground/60">
          Si alguien del equipo responde a mano un DM, el bot se pausa solo ahí por 6 horas para no pisarle la
          respuesta. Reanúdalo antes si ya terminaron de atenderlo.
        </p>
        <div className="mt-4 space-y-2">
          {state.pausedThreads.length === 0 ? (
            <p className="text-sm text-foreground/50">No hay conversaciones pausadas ahora mismo.</p>
          ) : (
            state.pausedThreads.map((p) => (
              <div
                key={p.senderId}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-foreground/10 px-4 py-3"
              >
                <div>
                  <p className="text-sm text-foreground/80">{p.lastUserMessage ?? "(sin mensaje registrado)"}</p>
                  <p className="mt-1 text-xs text-foreground/40">
                    IGSID {p.senderId} · se reanuda solo{" "}
                    {new Date(p.pausedUntil).toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" })}
                  </p>
                </div>
                <button
                  disabled={saving}
                  onClick={() => patch({ action: "resumeInstagramThread", senderId: p.senderId })}
                  className="shrink-0 rounded-lg bg-primary px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                >
                  Reanudar ahora
                </button>
              </div>
            ))
          )}
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

// Borrador editable del scope de una cuenta — solo se guarda al tocar
// "Guardar", así no se dispara un PATCH por cada click de checkbox.
function InstagramScopeRow({
  igAccountId,
  label,
  initial,
  saving,
  onSave,
}: {
  igAccountId: string;
  label: string;
  initial: InstagramScope;
  saving: boolean;
  onSave: (scope: InstagramScope) => void;
}) {
  const [draft, setDraft] = useState<InstagramScope>(initial);
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);

  function toggleVenue(v: Venue) {
    setDraft((d) => {
      const has = d.venues.includes(v);
      const venues = has ? d.venues.filter((x) => x !== v) : [...d.venues, v];
      // Al menos un local siempre tiene que quedar seleccionado.
      return venues.length ? { ...d, venues } : d;
    });
  }

  return (
    <div className="rounded-lg border border-foreground/10 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-medium text-foreground">
          {label} <span className="font-normal text-foreground/40">· {igAccountId}</span>
        </p>
        {/* Activo/inactivo primero y aparte: apaga el asistente del todo para
            esta cuenta (ni responde) — lo demás deja de importar si está apagada. */}
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={draft.enabled}
              onChange={(e) => setDraft((d) => ({ ...d, enabled: e.target.checked }))}
            />
            <span className={draft.enabled ? "text-primary" : "text-foreground/50"}>
              {draft.enabled ? "Activo" : "Inactivo — no responde"}
            </span>
          </label>
          <button
            disabled={saving || !dirty}
            onClick={() => onSave(draft)}
            className="rounded-lg bg-primary px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
          >
            Guardar
          </button>
        </div>
      </div>
      <div className={`mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm ${draft.enabled ? "" : "opacity-40"}`}>
        {(["renaca", "vina"] as const).map((v) => (
          <label key={v} className="flex items-center gap-2 text-foreground/80">
            <input
              type="checkbox"
              disabled={!draft.enabled}
              checked={draft.venues.includes(v)}
              onChange={() => toggleVenue(v)}
            />
            {VENUE_LABEL[v]}
          </label>
        ))}
        <label className="flex items-center gap-2 text-foreground/80">
          <input
            type="checkbox"
            disabled={!draft.enabled}
            checked={draft.allowReservations}
            onChange={(e) => setDraft((d) => ({ ...d, allowReservations: e.target.checked }))}
          />
          Permite reservas de mesa
        </label>
      </div>
    </div>
  );
}
