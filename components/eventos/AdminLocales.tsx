"use client";

import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import type { BrandKey, Local, Reservation } from "@/lib/mandagroup-catalog";

// Locales de cada marca con su canal de reservas (WhatsApp, Instagram, link o
// ninguno). El sitio (contacto), el asistente (derivar_reserva), las
// preguntas frecuentes y Google leen de acá. Se edita en borrador y se guarda
// la lista completa.
const BRANDS: { key: BrandKey; label: string }[] = [
  { key: "manda", label: "Manda" },
  { key: "carbon", label: "Carbon" },
  { key: "costa", label: "Costa Sushi" },
];

const input = "w-full rounded-lg border border-foreground/15 bg-background px-3 py-2 text-sm";

function slug(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function AdminLocales({
  locales,
  saving,
  onSave,
}: {
  locales: Local[];
  saving: boolean;
  onSave: (locales: Local[]) => Promise<void>;
}) {
  const [draft, setDraft] = useState<Local[]>(locales);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  useEffect(() => setDraft(locales), [locales]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(locales);

  const update = (id: string, patch: Partial<Local>) =>
    setDraft((list) => list.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  const move = (i: number, dir: -1 | 1) =>
    setDraft((list) => {
      const next = [...list];
      const j = i + dir;
      if (j < 0 || j >= next.length) return list;
      [next[i], next[j]] = [next[j], next[i]];
      return next.map((l, k) => ({ ...l, order: k }));
    });
  const setReservation = (id: string, type: Reservation["type"]) =>
    update(id, {
      reservation:
        type === "whatsapp"
          ? { type, phone: "" }
          : type === "instagram"
            ? { type, handle: "" }
            : type === "url"
              ? { type, url: "" }
              : { type: "none" },
    });

  return (
    <section className="rounded-2xl border border-foreground/10 p-6">
      <h2 className="font-heading text-lg font-semibold text-foreground">Locales y reservas</h2>
      <p className="mt-1 text-sm text-foreground/60">
        Cada local con su propio canal de reservas. El sitio y el asistente entregan exactamente este canal. El WhatsApp
        general es solo para consultas: no lo pongas acá.
      </p>

      <div className="mt-5 space-y-3">
        {draft.map((l, i) => {
          const r = l.reservation;
          return (
            <div key={l.id} className="rounded-xl border border-foreground/10 p-4">
              <div className="grid gap-3 sm:grid-cols-[1fr_10rem]">
                <label className="text-xs text-foreground/60">
                  Nombre del local
                  <input className={`${input} mt-1`} value={l.name} onChange={(e) => update(l.id, { name: e.target.value })} />
                </label>
                <label className="text-xs text-foreground/60">
                  Marca
                  <select
                    className={`${input} mt-1`}
                    value={l.brand}
                    onChange={(e) => update(l.id, { brand: e.target.value as BrandKey })}
                  >
                    {BRANDS.map((b) => (
                      <option key={b.key} value={b.key}>
                        {b.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs text-foreground/60">
                  Dirección (opcional)
                  <input
                    className={`${input} mt-1`}
                    value={l.address ?? ""}
                    placeholder="5 Norte 132, Viña del Mar"
                    onChange={(e) => update(l.id, { address: e.target.value || undefined })}
                  />
                </label>
                <label className="text-xs text-foreground/60">
                  Reservas por
                  <select
                    className={`${input} mt-1`}
                    value={r.type}
                    onChange={(e) => setReservation(l.id, e.target.value as Reservation["type"])}
                  >
                    <option value="whatsapp">WhatsApp</option>
                    <option value="instagram">Instagram</option>
                    <option value="url">Link (web)</option>
                    <option value="none">No toma reservas</option>
                  </select>
                </label>
                {r.type === "whatsapp" && (
                  <label className="text-xs text-foreground/60 sm:col-span-2">
                    WhatsApp de reservas (con código de país, solo números)
                    <input
                      className={`${input} mt-1`}
                      inputMode="numeric"
                      placeholder="56990721033"
                      value={r.phone}
                      onChange={(e) => update(l.id, { reservation: { type: "whatsapp", phone: e.target.value.replace(/\D/g, "") } })}
                    />
                  </label>
                )}
                {r.type === "instagram" && (
                  <label className="text-xs text-foreground/60 sm:col-span-2">
                    Cuenta de Instagram
                    <input
                      className={`${input} mt-1`}
                      placeholder="mandavina.cl"
                      value={r.handle}
                      onChange={(e) => update(l.id, { reservation: { type: "instagram", handle: e.target.value.replace(/^@/, "").trim() } })}
                    />
                  </label>
                )}
                {r.type === "url" && (
                  <label className="text-xs text-foreground/60 sm:col-span-2">
                    Link de reservas
                    <input
                      className={`${input} mt-1`}
                      placeholder="https://…"
                      value={r.url}
                      onChange={(e) => update(l.id, { reservation: { ...r, url: e.target.value.trim() } })}
                    />
                  </label>
                )}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-4 text-xs">
                <label className="inline-flex items-center gap-2 text-foreground/70">
                  <input type="checkbox" checked={l.showOnSite} onChange={(e) => update(l.id, { showOnSite: e.target.checked })} />
                  Mostrar en el sitio
                </label>
                <div className="ml-auto flex items-center gap-1">
                  <button aria-label="Subir" onClick={() => move(i, -1)} className="rounded-md p-1.5 text-foreground/60 hover:bg-foreground/10">
                    <ArrowUp size={14} />
                  </button>
                  <button aria-label="Bajar" onClick={() => move(i, 1)} className="rounded-md p-1.5 text-foreground/60 hover:bg-foreground/10">
                    <ArrowDown size={14} />
                  </button>
                  <button
                    onClick={() => {
                      if (confirmDelete !== l.id) return setConfirmDelete(l.id);
                      setDraft((list) => list.filter((x) => x.id !== l.id));
                      setConfirmDelete(null);
                    }}
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-red-400 hover:bg-red-500/10"
                  >
                    <Trash2 size={14} />
                    {confirmDelete === l.id ? "¿Eliminar? Confirmar" : "Eliminar"}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          onClick={() =>
            setDraft((list) => [
              ...list,
              {
                id: `local-${Date.now().toString(36)}`,
                brand: "costa",
                name: "Nuevo local",
                reservation: { type: "none" },
                showOnSite: true,
                order: list.length,
              },
            ])
          }
          className="inline-flex items-center gap-1.5 rounded-lg border border-foreground/15 px-4 py-2 text-sm font-semibold text-foreground hover:border-primary"
        >
          <Plus size={15} />
          Agregar local
        </button>
        <button
          disabled={saving || !dirty}
          onClick={() => {
            // Ids estables y únicos para los locales nuevos (a partir del nombre).
            const taken = new Set(draft.filter((l) => !l.id.startsWith("local-")).map((l) => l.id));
            return onSave(
              draft.map((l, k) => {
                if (!l.id.startsWith("local-")) return { ...l, order: k };
                let id = slug(l.name) || "local";
                for (let n = 2; taken.has(id); n++) id = `${slug(l.name) || "local"}-${n}`;
                taken.add(id);
                return { ...l, id, order: k };
              })
            );
          }}
          className="rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          Guardar locales
        </button>
        {dirty && <span className="text-xs text-foreground/60">Hay cambios sin guardar.</span>}
      </div>
    </section>
  );
}
