// Extrae una paleta de UI desde el logo de un cliente y la imprime lista para
// pegar en config/client.config.ts, junto con dos variantes alternativas para
// themeVariants (previsualizables en /variantes).
//
// Uso: npm run palette -- ruta/al/logo.(svg|png|jpg)
//
// Los colores de un logo no siempre sirven como colores de UI: aquí se valida
// contraste WCAG (texto blanco sobre primary; foreground sobre background) y se
// oscurece/aclara automáticamente lo que no cumple, avisando qué se ajustó.
import { readFileSync } from "node:fs";
import path from "node:path";

export type RGB = { r: number; g: number; b: number };

// ---------- color utils ----------

export function hexToRgb(hex: string): RGB | null {
  const m = hex.replace("#", "").match(/^([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

export function rgbToHex({ r, g, b }: RGB): string {
  return "#" + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("").toUpperCase();
}

function luminance({ r, g, b }: RGB): number {
  const f = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

export function contrast(a: RGB, b: RGB): number {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

function rgbToHsl({ r, g, b }: RGB): { h: number; s: number; l: number } {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
  else if (max === gn) h = ((bn - rn) / d + 2) / 6;
  else h = ((rn - gn) / d + 4) / 6;
  return { h: h * 360, s, l };
}

export function hslToRgb(h: number, s: number, l: number): RGB {
  h = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let rp = 0, gp = 0, bp = 0;
  if (h < 60) [rp, gp, bp] = [c, x, 0];
  else if (h < 120) [rp, gp, bp] = [x, c, 0];
  else if (h < 180) [rp, gp, bp] = [0, c, x];
  else if (h < 240) [rp, gp, bp] = [0, x, c];
  else if (h < 300) [rp, gp, bp] = [x, 0, c];
  else [rp, gp, bp] = [c, 0, x];
  return { r: (rp + m) * 255, g: (gp + m) * 255, b: (bp + m) * 255 };
}

export const WHITE: RGB = { r: 255, g: 255, b: 255 };

// Oscurece un color hasta que el texto blanco encima cumpla WCAG AA (4.5:1).
export function ensureContrastWithWhite(rgb: RGB): { color: RGB; adjusted: boolean } {
  if (contrast(rgb, WHITE) >= 4.5) return { color: rgb, adjusted: false };
  const { h, s, l } = rgbToHsl(rgb);
  let lo = 0, hi = l;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (contrast(hslToRgb(h, s, mid), WHITE) >= 4.5) lo = mid;
    else hi = mid;
  }
  return { color: hslToRgb(h, s, lo), adjusted: true };
}

// ---------- extracción de colores ----------

function colorsFromSvg(source: string): { rgb: RGB; weight: number }[] {
  // En un SVG los colores están declarados en el código: fill, stroke, stop-color
  // y estilos inline. Se cuentan las apariciones como peso.
  const counts = new Map<string, number>();
  const patterns = [/(?:fill|stroke|stop-color)\s*[:=]\s*["']?(#[0-9a-fA-F]{3,6})/g];
  for (const re of patterns) {
    for (const m of source.matchAll(re)) {
      const rgb = hexToRgb(m[1]);
      if (!rgb) continue;
      const hex = rgbToHex(rgb);
      counts.set(hex, (counts.get(hex) ?? 0) + 1);
    }
  }
  return [...counts.entries()].map(([hex, weight]) => ({ rgb: hexToRgb(hex)!, weight }));
}

function colorsFromPixels(data: Uint8Array | Buffer, hasAlpha: boolean): { rgb: RGB; weight: number }[] {
  // Cuantiza a 4 bits por canal para agrupar tonos casi iguales.
  const counts = new Map<number, number>();
  const step = hasAlpha ? 4 : 3;
  for (let i = 0; i + step - 1 < data.length; i += step) {
    if (hasAlpha && data[i + 3] < 128) continue; // transparente
    const key = ((data[i] >> 4) << 8) | ((data[i + 1] >> 4) << 4) | (data[i + 2] >> 4);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()].map(([key, weight]) => ({
    rgb: {
      r: ((key >> 8) & 0xf) * 17,
      g: ((key >> 4) & 0xf) * 17,
      b: (key & 0xf) * 17,
    },
    weight,
  }));
}

export function extractColors(filePath: string): { rgb: RGB; weight: number }[] {
  const ext = path.extname(filePath).toLowerCase();
  const buf = readFileSync(filePath);
  if (ext === ".svg") return colorsFromSvg(buf.toString("utf-8"));
  if (ext === ".png") {
    const { PNG } = require("pngjs") as typeof import("pngjs");
    const png = PNG.sync.read(buf);
    return colorsFromPixels(png.data, true);
  }
  if (ext === ".jpg" || ext === ".jpeg") {
    const jpeg = require("jpeg-js") as typeof import("jpeg-js");
    const img = jpeg.decode(buf, { useTArray: true, maxMemoryUsageInMB: 512 });
    return colorsFromPixels(img.data, true);
  }
  console.error(`Formato no soportado: ${ext} (usa .svg, .png o .jpg)`);
  process.exit(1);
}

// ---------- armado de paleta ----------

export function pickPalette(colors: { rgb: RGB; weight: number }[]) {
  // Candidatos a color de marca: ni casi blanco, ni casi negro, ni grises.
  const candidates = colors
    .map((c) => ({ ...c, hsl: rgbToHsl(c.rgb) }))
    .filter((c) => c.hsl.l > 0.08 && c.hsl.l < 0.92 && c.hsl.s > 0.15)
    .sort((a, b) => b.weight * (0.4 + b.hsl.s) - a.weight * (0.4 + a.hsl.s));

  if (candidates.length === 0) {
    console.error(
      "No se encontraron colores de marca utilizables en el logo (¿es blanco y negro?).\n" +
        "En ese caso elige la paleta a mano o usa un preset como punto de partida."
    );
    process.exit(1);
  }

  const primaryRaw = candidates[0];
  // Accent: el siguiente color con tono suficientemente distinto (>30°).
  const accentRaw =
    candidates.find((c) => {
      const dh = Math.abs(c.hsl.h - primaryRaw.hsl.h);
      return Math.min(dh, 360 - dh) > 30;
    }) ?? candidates[Math.min(1, candidates.length - 1)];

  const primary = ensureContrastWithWhite(primaryRaw.rgb);

  // Background: blanco cálido teñido apenas con el tono del primary.
  const bg = hslToRgb(primaryRaw.hsl.h, 0.18, 0.98);
  // Foreground: casi negro teñido con el tono del primary, contraste garantizado.
  let fg = hslToRgb(primaryRaw.hsl.h, 0.25, 0.12);
  if (contrast(fg, bg) < 7) fg = hslToRgb(primaryRaw.hsl.h, 0.25, 0.08);

  return {
    primary: rgbToHex(primary.color),
    primaryAdjusted: primary.adjusted,
    primaryOriginal: rgbToHex(primaryRaw.rgb),
    accent: rgbToHex(accentRaw.rgb),
    background: rgbToHex(bg),
    foreground: rgbToHex(fg),
    baseHsl: primaryRaw.hsl,
    accentHsl: accentRaw.hsl,
  };
}

