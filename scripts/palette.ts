#!/usr/bin/env tsx
// Extrae una paleta de UI desde el logo de un cliente y la imprime lista para
// pegar en config/client.config.ts, junto con dos variantes alternativas para
// themeVariants (previsualizables en /variantes). La lógica vive en
// palette-core.ts (compartida con el wizard de new-client).
//
// Uso: npm run palette -- ruta/al/logo.(svg|png|jpg)
import path from "node:path";
import {
  extractColors,
  pickPalette,
  ensureContrastWithWhite,
  hexToRgb,
  rgbToHex,
  hslToRgb,
  contrast,
  WHITE,
} from "./palette-core";

const file = process.argv[2];
if (!file) {
  console.error("Uso: npm run palette -- ruta/al/logo.(svg|png|jpg)");
  process.exit(1);
}

const p = pickPalette(extractColors(file));

// Variante B: acento como protagonista. Variante C: versión oscura del primary.
const accentAsPrimary = ensureContrastWithWhite(hexToRgb(p.accent)!);
const darkBg = hslToRgb(p.baseHsl.h, 0.3, 0.1);
const darkPrimary = ensureContrastWithWhite(hslToRgb(p.baseHsl.h, Math.max(p.baseHsl.s, 0.5), 0.45));

console.log(`Paleta extraída de ${path.basename(file)}\n`);
if (p.primaryAdjusted) {
  console.log(`⚠ El color dominante del logo (${p.primaryOriginal}) no cumplía contraste WCAG AA`);
  console.log(`  con texto blanco encima — se oscureció a ${p.primary}.\n`);
}
console.log(`Pega esto en config/client.config.ts → branding:\n`);
console.log(`    palette: {
      primary: "${p.primary}",
      accent: "${p.accent}",
      background: "${p.background}",
      foreground: "${p.foreground}",
    },`);
console.log(`\nY si quieres mostrar alternativas al cliente en /variantes:\n`);
console.log(`  themeVariants: [
    {
      id: "a",
      name: "Fiel al logo",
      palette: { primary: "${p.primary}", accent: "${p.accent}", background: "${p.background}", foreground: "${p.foreground}" },
    },
    {
      id: "b",
      name: "Acento protagonista",
      palette: { primary: "${rgbToHex(accentAsPrimary.color)}", accent: "${p.primary}", background: "${rgbToHex(hslToRgb(p.accentHsl.h, 0.18, 0.98))}", foreground: "${p.foreground}" },
    },
    {
      id: "c",
      name: "Modo oscuro",
      palette: { primary: "${rgbToHex(darkPrimary.color)}", accent: "${p.accent}", background: "${rgbToHex(darkBg)}", foreground: "#F4F2EF" },
    },
  ],`);
console.log(`\nContrastes (WCAG AA pide 4.5:1 en texto normal):`);
console.log(`  blanco sobre primary:      ${contrast(hexToRgb(p.primary)!, WHITE).toFixed(2)}:1`);
console.log(`  foreground sobre background: ${contrast(hexToRgb(p.foreground)!, hexToRgb(p.background)!).toFixed(2)}:1`);
