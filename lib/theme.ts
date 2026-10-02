import type { CSSProperties } from "react";
import type { ClientConfig } from "@/config/schema";

// "R G B" separado por espacio, no "#rrggbb": es el formato que
// tailwind.config.ts necesita para poder componer estos colores con las
// utilidades de opacidad (text-foreground/70, bg-primary/10, etc.) vía
// rgb(var(--x) / <alpha-value>) — con un hex crudo, Tailwind no genera esas
// clases y quedan como no-ops silenciosos.
function hexToRgbTriplet(hex: string): string {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `${r} ${g} ${b}`;
}

export function paletteToCssVars(palette: ClientConfig["branding"]["palette"]): CSSProperties {
  return {
    "--color-primary": hexToRgbTriplet(palette.primary),
    "--color-accent": hexToRgbTriplet(palette.accent),
    "--color-background": hexToRgbTriplet(palette.background),
    "--color-foreground": hexToRgbTriplet(palette.foreground),
  } as CSSProperties;
}
