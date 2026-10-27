"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import type { IgLogEntry, IgOutcome } from "@/lib/ig-inbox-log";

// Bandeja de Instagram en el panel: cada DM que llegó y qué hizo el asistente.
// Por defecto muestra los que quedaron SIN respuesta del asistente, con el
// motivo y qué hacer — para responder "¿por qué no le contestó a fulano?" sin
// depender de los logs de Vercel (que duran 1 hora).

const OUTCOME: Record<IgOutcome, { label: string; tone: string; help?: string }> = {
  respondido: { label: "Respondido", tone: "bg-emerald-500/15 text-emerald-300" },
  equipo_respondio: { label: "Respondió el equipo", tone: "bg-sky-500/15 text-sky-300" },
  pausado: {
    label: "En pausa (atendía el equipo)",
    tone: "bg-amber-500/15 text-amber-300",
    help: "Alguien del equipo había escrito a mano en este chat hace menos de 6 horas. Si ya terminaron, reanúdalo en «Conversaciones pausadas».",
  },
  cuenta_desactivada: {
    label: "Asistente apagado en esta cuenta",
    tone: "bg-amber-500/15 text-amber-300",
    help: "Se enciende en «Instagram por cuenta».",
  },
  adjunto: {
    label: "Audio / foto / publicación",
    tone: "bg-foreground/10 text-foreground/70",
    help: "El asistente solo lee texto: hay que responderlo a mano.",
  },
  historia: {
    label: "Respuesta o mención a historia",
    tone: "bg-foreground/10 text-foreground/70",
    help: "No se responden automáticamente.",
  },
  sin_respuesta_modelo: {
    label: "La IA no generó respuesta",
    tone: "bg-red-500/15 text-red-300",
    help: "Hay que responderlo a mano. Si se repite, avísale a soporte.",
  },
  error_envio: {
    label: "Instagram rechazó el envío",
    tone: "bg-red-500/15 text-red-300",
    help: "Suele ser el permiso (token) de la cuenta vencido o revocado. Avísale a soporte con el detalle.",
  },
  error: { label: "Error inesperado", tone: "bg-red-500/15 text-red-300", help: "Avísale a soporte con el detalle." },
};

const ANSWERED: IgOutcome[] = ["respondido", "equipo_respondio"];

type Filter = "sin_respuesta" | "todos" | IgOutcome;

export function AdminInstagramInbox({
  adminKey,
  accountLabels,
}: {
  adminKey: string | null;
  accountLabels: Record<string, string>;
}) {
  const [days, setDays] = useState(7);
  const [account, setAccount] = useState<string>("todas");
  const [filter, setFilter] = useState<Filter>("sin_respuesta");
  const [events, setEvents] = useState<IgLogEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/eventos/instagram?days=${days}`, {
        headers: adminKey ? { "x-eventos-key": adminKey } : undefined,
      });
      if (!res.ok) throw new Error();
      setEvents(((await res.json()) as { events: IgLogEntry[] }).events);
    } catch {
      setError("No se pudo cargar la bandeja.");
    } finally {
      setLoading(false);
    }
  }, [days, adminKey]);

  useEffect(() => {
    load();
  }, [load]);

  const byAccount = useMemo(
    () => (events ?? []).filter((e) => account === "todas" || e.accountId === account),
    [events, account]
  );

  const counts = useMemo(() => {
    const c: Partial<Record<IgOutcome, number>> = {};
    for (const e of byAccount) c[e.outcome] = (c[e.outcome] ?? 0) + 1;
    return c;
  }, [byAccount]);
  // Clientes que escribieron (sin contar lo que escribió el equipo).
  const incoming = byAccount.filter((e) => e.outcome !== "equipo_respondio").length;
  const unanswered = byAccount.filter((e) => !ANSWERED.includes(e.outcome)).length;

  const visible = byAccount.filter((e) =>
    filter === "todos" ? true : filter === "sin_respuesta" ? !ANSWERED.includes(e.outcome) : e.outcome === filter
  );

  const chip = (active: boolean) =>
    `rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
      active ? "bg-primary text-background" : "bg-foreground/[0.07] text-foreground/70 hover:text-foreground"
    }`;

  return (
    <section id="bandeja-instagram" className="scroll-mt-24 rounded-2xl border border-foreground/10 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-heading text-lg font-semibold text-foreground">Bandeja de Instagram</h2>
          <p className="mt-1 max-w-[60ch] text-sm text-foreground/60">
            Cada mensaje que llegó a las cuentas y qué hizo el asistente. Se guarda 30 días.
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-lg border border-foreground/15 px-3 py-1.5 text-xs font-semibold text-foreground/80 hover:bg-foreground/5 disabled:opacity-50"
        >
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} aria-hidden />
          Actualizar
        </button>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {[1, 7, 30].map((d) => (
          <button key={d} onClick={() => setDays(d)} className={chip(days === d)}>
            {d === 1 ? "Últimas 24 h" : `${d} días`}
          </button>
        ))}
        <select
          value={account}
          onChange={(e) => setAccount(e.target.value)}
          className="ml-auto rounded-lg border border-foreground/15 bg-background px-3 py-1.5 text-xs text-foreground"
          aria-label="Cuenta"
        >
          <option value="todas">Todas las cuentas</option>
          {Object.entries(accountLabels).map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

      {events && (
        <>
          <div className="mt-5 grid grid-cols-3 gap-3">
            <Stat label="Mensajes de clientes" value={incoming} />
            <Stat label="Respondidos por el asistente" value={counts.respondido ?? 0} />
            <Stat label="Sin respuesta del asistente" value={unanswered} highlight={unanswered > 0} />
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <button onClick={() => setFilter("sin_respuesta")} className={chip(filter === "sin_respuesta")}>
              Sin respuesta ({unanswered})
            </button>
            <button onClick={() => setFilter("todos")} className={chip(filter === "todos")}>
              Todos ({byAccount.length})
            </button>
            {(Object.keys(OUTCOME) as IgOutcome[])
              .filter((o) => counts[o])
              .map((o) => (
                <button key={o} onClick={() => setFilter(o)} className={chip(filter === o)}>
                  {OUTCOME[o].label} ({counts[o]})
                </button>
              ))}
          </div>

          <ul className="mt-4 space-y-2">
            {visible.length === 0 ? (
              <li className="rounded-lg border border-foreground/10 px-4 py-6 text-center text-sm text-foreground/50">
                {filter === "sin_respuesta" ? "Todos los mensajes de este período tuvieron respuesta." : "No hay mensajes."}
              </li>
            ) : (
              visible.map((e) => <InboxRow key={e.id} entry={e} accountLabel={e.accountId ? accountLabels[e.accountId] : undefined} />)
            )}
          </ul>
        </>
      )}
    </section>
  );
}

function Stat({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className={`rounded-xl px-4 py-3 ${highlight ? "bg-amber-500/10 ring-1 ring-amber-500/30" : "bg-foreground/[0.04]"}`}>
      <p className="font-heading text-2xl font-semibold tabular-nums text-foreground">{value}</p>
      <p className="mt-0.5 text-xs text-foreground/60">{label}</p>
    </div>
  );
}

function InboxRow({ entry: e, accountLabel }: { entry: IgLogEntry; accountLabel?: string }) {
  const [open, setOpen] = useState(false);
  const o = OUTCOME[e.outcome];
  const who = e.outcome === "equipo_respondio" ? "Equipo" : e.senderName || `Usuario ${e.senderId?.slice(-6) ?? ""}`;
  const message = e.outcome === "adjunto" ? `(${e.detail ?? "adjunto"})` : e.text ?? "(sin texto)";
  // Lo que respondió el asistente o el detalle técnico del error, plegado.
  const extra = e.outcome === "adjunto" || e.outcome === "equipo_respondio" ? null : e.detail;

  return (
    <li className="rounded-lg border border-foreground/10 px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-foreground/50">
        <time dateTime={e.createdAt}>
          {new Date(e.createdAt).toLocaleString("es-CL", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
        </time>
        {accountLabel && <span>{accountLabel}</span>}
        <span className="font-semibold text-foreground/80">{who}</span>
        <span className={`ml-auto rounded-full px-2.5 py-0.5 font-semibold ${o.tone}`}>{o.label}</span>
      </div>
      <p className="mt-2 text-sm text-foreground/90">{message}</p>
      {o.help && <p className="mt-1.5 text-xs text-foreground/50">{o.help}</p>}
      {extra && (
        <button onClick={() => setOpen((v) => !v)} className="mt-1.5 text-xs text-primary underline underline-offset-2">
          {open ? "Ocultar" : e.outcome === "respondido" ? "Ver respuesta del asistente" : "Ver detalle"}
        </button>
      )}
      {open && extra && (
        <p className="mt-2 whitespace-pre-wrap rounded-md bg-foreground/[0.04] px-3 py-2 text-xs text-foreground/70">{extra}</p>
      )}
    </li>
  );
}
