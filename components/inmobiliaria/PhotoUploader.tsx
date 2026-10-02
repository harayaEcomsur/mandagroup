"use client";

import { useRef, useState } from "react";

// Redimensiona en el navegador (máx. 1600px de lado más largo, JPEG ~0.75)
// antes de subir — así una foto de celular de 4-8MB llega al servidor pesando
// unos cientos de KB, sin depender de una librería nativa (sharp, etc.) que
// las funciones serverless no necesitan cargar para esto.
async function resizeImage(file: File, maxSide = 1600, quality = 0.75): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas no disponible");
  ctx.drawImage(bitmap, 0, 0, w, h);
  const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
  if (!blob) throw new Error("No se pudo comprimir la imagen");
  return blob;
}

export function PhotoUploader({
  photos,
  onChange,
  authHeaders,
  max = 20,
}: {
  photos: string[];
  onChange: (urls: string[]) => void;
  authHeaders: Record<string, string>;
  max?: number;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    setUploading(true);
    try {
      const room = Math.max(0, max - photos.length);
      const list = Array.from(files).slice(0, room);
      const uploaded: string[] = [];
      for (const file of list) {
        const resized = await resizeImage(file);
        const form = new FormData();
        form.append("file", resized, "foto.jpg");
        const res = await fetch("/api/inmobiliaria/upload", { method: "POST", headers: authHeaders, body: form });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Error al subir la foto");
        uploaded.push(data.url);
      }
      onChange([...photos, ...uploaded]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al subir fotos");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {photos.map((url) => (
          <div key={url} className="group relative h-20 w-20 overflow-hidden rounded-lg border border-foreground/15">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="" className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => onChange(photos.filter((p) => p !== url))}
              className="absolute right-0.5 top-0.5 rounded-full bg-black/60 px-1.5 text-xs text-white opacity-0 transition group-hover:opacity-100"
            >
              ×
            </button>
          </div>
        ))}
        {photos.length < max && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="flex h-20 w-20 flex-col items-center justify-center rounded-lg border border-dashed border-foreground/25 text-xs text-foreground/60 hover:border-primary hover:text-primary disabled:opacity-50"
          >
            {uploading ? "Subiendo…" : "+ Foto"}
          </button>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
