"use client";

import { useEffect, useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import { ArrowDown, ArrowUp, ExternalLink, FileText, Plus, Trash2, Upload } from "lucide-react";
import type { BrandKey, Carta } from "@/lib/mandagroup-catalog";

// Cartas de cada marca: un PDF (se sube directo a Vercel Blob) o un link
// externo (ej. el menú de Costa Sushi en Fudo). Cada carta puede tener URLs de
// QR ya impresos ("/cmanda.pdf") que siempre llevan a su versión vigente.
const BRANDS: { key: BrandKey; label: string }[] = [
  { key: "manda", label: "Manda" },
  { key: "carbon", label: "Carbon" },
  { key: "costa", label: "Costa Sushi" },
];

const input = "w-full rounded-lg border border-foreground/15 bg-background px-3 py-2 text-sm";

function slug(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function uniqueId(base: string, taken: Set<string>): string {
  let id = base || "carta";
  for (let n = 2; taken.has(id); n++) id = `${base}-${n}`;
  return id;
}

function CartaRow({
  carta,
  index,
  adminKey,
  siteOrigin,
  onChange,
  onMove,
  onDelete,
}: {
  carta: Carta;
  index: number;
  adminKey: string | null;
  siteOrigin: string;
  onChange: (patch: Partial<Carta>) => void;
  onMove: (dir: -1 | 1) => void;
  onDelete: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [aliasText, setAliasText] = useState(carta.aliases.join(", "));
  useEffect(() => setAliasText(carta.aliases.join(", ")), [carta.aliases]);
  const src = carta.source;

  async function handleFile(file: File) {
    setUploadError(null);
    if (file.type !== "application/pdf") return setUploadError("Solo se aceptan archivos PDF.");
    setProgress(0);
    try {
      const blob = await upload(`cartas/${slug(carta.title) || "carta"}.pdf`, file, {
        access: "public",
        contentType: "application/pdf",
        handleUploadUrl: "/api/eventos/upload",
        clientPayload: adminKey ?? "",
        // Sin onUploadProgress: con él, la librería reintenta reusando un
        // stream ya consumido y la subida falla ("ReadableStream is disturbed").
        multipart: file.size > 8 * 1024 * 1024,
      });
      // Archivo nuevo: sin páginas pre-convertidas, el sitio dibuja el PDF.
      onChange({ source: { type: "file", url: blob.url, sizeBytes: file.size }, updatedAt: new Date().toISOString() });
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "No se pudo subir el archivo.");
    } finally {
      setProgress(null);
    }
  }

  return (
    <div className="rounded-xl border border-foreground/10 p-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_10rem]">
        <label className="text-xs text-foreground/60">
          Título
          <input className={`${input} mt-1`} value={carta.title} onChange={(e) => onChange({ title: e.target.value })} />
        </label>
        <label className="text-xs text-foreground/60">
          Marca
          <select className={`${input} mt-1`} value={carta.brand} onChange={(e) => onChange({ brand: e.target.value as BrandKey })}>
            {BRANDS.map((b) => (
              <option key={b.key} value={b.key}>
                {b.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-foreground/60 sm:col-span-2">
          Descripción corta (opcional)
          <input
            className={`${input} mt-1`}
            value={carta.description ?? ""}
            onChange={(e) => onChange({ description: e.target.value || undefined })}
          />
        </label>
      </div>

      {/* Contenido: archivo PDF o link externo */}
      <div className="mt-3 rounded-lg bg-foreground/[0.03] p-3">
        <div className="flex flex-wrap gap-2 text-xs">
          {(["file", "url"] as const).map((t) => (
            <button
              key={t}
              onClick={() =>
                src.type !== t &&
                onChange({
                  source: t === "file" ? { type: "file", url: "" } : { type: "url", url: "" },
                  updatedAt: new Date().toISOString(),
                })
              }
              className={`rounded-full px-3 py-1 font-semibold ${src.type === t ? "bg-primary text-white" : "bg-foreground/10 text-foreground/60"}`}
            >
              {t === "file" ? "Archivo PDF" : "Link externo"}
            </button>
          ))}
        </div>
        {src.type === "file" ? (
          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
            {src.url ? (
              <a href={src.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-primary underline">
                <FileText size={14} />
                Ver PDF actual
                {src.sizeBytes ? ` (${(src.sizeBytes / 1048576).toFixed(1)} MB)` : ""}
              </a>
            ) : (
              <span className="text-foreground/50">Sin archivo todavía.</span>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
                e.target.value = "";
              }}
            />
            <button
              disabled={progress !== null}
              onClick={() => fileRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-foreground/15 px-3 py-1.5 text-xs font-semibold text-foreground hover:border-primary disabled:opacity-50"
            >
              <Upload size={13} />
              {progress !== null ? "Subiendo…" : src.url ? "Reemplazar PDF" : "Subir PDF"}
            </button>
          </div>
        ) : (
          <label className="mt-3 block text-xs text-foreground/60">
            Link de la carta (ej. menú en Fudo)
            <input
              className={`${input} mt-1`}
              placeholder="https://…"
              value={src.url}
              onChange={(e) => onChange({ source: { type: "url", url: e.target.value.trim() }, updatedAt: new Date().toISOString() })}
            />
          </label>
        )}
        {uploadError && <p className="mt-2 text-xs text-red-400">{uploadError}</p>}
      </div>

      <label className="mt-3 block text-xs text-foreground/60">
        URLs de QR (separadas por coma) — siempre llevan a esta carta, sea PDF o link
        <input
          className={`${input} mt-1`}
          placeholder="/cmanda.pdf, /carta-manda"
          value={aliasText}
          onChange={(e) => setAliasText(e.target.value)}
          onBlur={() =>
            onChange({
              aliases: aliasText
                .split(/[,\n]/)
                .map((a) => a.trim())
                .filter(Boolean)
                .map((a) => ("/" + a.replace(/^https?:\/\/[^/]+/i, "").replace(/^\/+/, "")).toLowerCase()),
            })
          }
        />
      </label>
      {carta.aliases.length > 0 && (
        <p className="mt-1 text-xs text-foreground/50">
          {carta.aliases.map((a) => (
            <a key={a} href={a} target="_blank" rel="noreferrer" className="mr-3 inline-flex items-center gap-1 hover:text-primary">
              {siteOrigin}
              {a}
              <ExternalLink size={11} />
            </a>
          ))}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-4 text-xs">
        <label className="inline-flex items-center gap-2 text-foreground/70">
          <input type="checkbox" checked={carta.showOnSite} onChange={(e) => onChange({ showOnSite: e.target.checked })} />
          Mostrar en /carta
        </label>
        <label className="inline-flex items-center gap-2 text-foreground/70">
          <input type="checkbox" checked={carta.onCarbonPage} onChange={(e) => onChange({ onCarbonPage: e.target.checked })} />
          Mostrar en /carbon (QR de mesa)
        </label>
        <div className="ml-auto flex items-center gap-1">
          <button aria-label="Subir" onClick={() => onMove(-1)} disabled={index === 0} className="rounded-md p-1.5 text-foreground/60 hover:bg-foreground/10 disabled:opacity-30">
            <ArrowUp size={14} />
          </button>
          <button aria-label="Bajar" onClick={() => onMove(1)} className="rounded-md p-1.5 text-foreground/60 hover:bg-foreground/10">
            <ArrowDown size={14} />
          </button>
          <button
            onClick={() => (confirmDelete ? onDelete() : setConfirmDelete(true))}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-red-400 hover:bg-red-500/10"
          >
            <Trash2 size={14} />
            {confirmDelete
              ? carta.aliases.length
                ? "¿Eliminar? Sus URLs de QR dejan de funcionar"
                : "¿Eliminar? Confirmar"
              : "Eliminar"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function AdminCartas({
  cartas,
  adminKey,
  saving,
  onSave,
}: {
  cartas: Carta[];
  adminKey: string | null;
  saving: boolean;
  onSave: (cartas: Carta[]) => Promise<void>;
}) {
  const [draft, setDraft] = useState<Carta[]>(cartas);
  const [origin, setOrigin] = useState("");
  useEffect(() => setDraft(cartas), [cartas]);
  useEffect(() => setOrigin(window.location.origin), []);
  const dirty = JSON.stringify(draft) !== JSON.stringify(cartas);
  const incomplete = draft.some((c) => !c.source.url);

  const update = (id: string, patch: Partial<Carta>) => setDraft((list) => list.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  const move = (i: number, dir: -1 | 1) =>
    setDraft((list) => {
      const next = [...list];
      const j = i + dir;
      if (j < 0 || j >= next.length) return list;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  return (
    <section className="rounded-2xl border border-foreground/10 p-6">
      <h2 className="font-heading text-lg font-semibold text-foreground">Cartas</h2>
      <p className="mt-1 text-sm text-foreground/60">
        Sube el PDF o pega el link de cada carta. Al reemplazar un PDF, sus QR ya impresos muestran la versión nueva sin
        reimprimir nada.
      </p>

      <div className="mt-5 space-y-3">
        {draft.map((c, i) => (
          <CartaRow
            key={c.id}
            carta={c}
            index={i}
            adminKey={adminKey}
            siteOrigin={origin}
            onChange={(patch) => update(c.id, patch)}
            onMove={(dir) => move(i, dir)}
            onDelete={() => setDraft((list) => list.filter((x) => x.id !== c.id))}
          />
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          onClick={() =>
            setDraft((list) => [
              ...list,
              {
                id: `nueva-${Date.now().toString(36)}`,
                brand: "manda",
                title: "Nueva carta",
                source: { type: "file", url: "" },
                showOnSite: true,
                onCarbonPage: false,
                aliases: [],
                order: list.length,
                updatedAt: new Date().toISOString(),
              },
            ])
          }
          className="inline-flex items-center gap-1.5 rounded-lg border border-foreground/15 px-4 py-2 text-sm font-semibold text-foreground hover:border-primary"
        >
          <Plus size={15} />
          Agregar carta
        </button>
        <button
          disabled={saving || !dirty || incomplete}
          onClick={() => {
            const taken = new Set<string>();
            const ready = draft.map((c, k) => {
              const id = c.id.startsWith("nueva-") ? uniqueId(slug(c.title), new Set([...taken, ...draft.map((d) => d.id)])) : c.id;
              taken.add(id);
              return { ...c, id, order: k };
            });
            return onSave(ready);
          }}
          className="rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          Guardar cartas
        </button>
        {incomplete && <span className="text-xs text-red-400">Hay cartas sin archivo ni link.</span>}
        {!incomplete && dirty && <span className="text-xs text-foreground/60">Hay cambios sin guardar.</span>}
      </div>
    </section>
  );
}
