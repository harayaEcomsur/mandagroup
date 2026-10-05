import {
  Inter,
  Poppins,
  Lora,
  Work_Sans,
  Quicksand,
  Nunito,
  Playfair_Display,
  Bricolage_Grotesque,
  Hanken_Grotesk,
} from "next/font/google";

// preload: false en todos los pares que este sitio NO usa: next/font precarga
// cada fuente declarada en este módulo, aunque el sitio use un solo par —
// eran 11 archivos (~350 KB) en prioridad alta compitiendo con la foto del
// hero (el LCP). Solo el par activo (hoy "nocturno") queda con preload: true;
// al cambiar fontPairing en el config, mover el preload a ese par (next/font
// exige literales, no puede leerse del config).
const interFont = Inter({ subsets: ["latin"], preload: false, variable: "--font-body" });
const poppinsFont = Poppins({ subsets: ["latin"], preload: false, weight: ["500", "600", "700"], variable: "--font-heading" });

const loraFont = Lora({ subsets: ["latin"], preload: false, variable: "--font-heading" });
const workSansFont = Work_Sans({ subsets: ["latin"], preload: false, variable: "--font-body" });

const quicksandFont = Quicksand({ subsets: ["latin"], preload: false, weight: ["500", "600", "700"], variable: "--font-heading" });
const nunitoFont = Nunito({ subsets: ["latin"], preload: false, variable: "--font-body" });

// Playfair Display + Inter: par recomendado por ui-ux-pro-max (--design-system
// "beauty salon hair services elegant") para belleza/spa/lujo — serif editorial
// de más carácter que Lora, para rubros que piden "elegante CON estilo", no solo
// prolijo (ver README → "Diseño distintivo por cliente").
const playfairFont = Playfair_Display({ subsets: ["latin"], preload: false, weight: ["500", "600", "700"], variable: "--font-heading" });

// Bricolage Grotesque + Hanken Grotesk: sans de display con carácter (no la
// serif "de lujo" por defecto) para marcas nocturnas/corporativas — un
// holding de clubes y restaurantes se lee moderno y seguro, no editorial.
const bricolageFont = Bricolage_Grotesque({ subsets: ["latin"], preload: true, weight: ["500", "600", "700"], variable: "--font-heading" });
const hankenFont = Hanken_Grotesk({ subsets: ["latin"], preload: true, variable: "--font-body" });

export const fontPairings = {
  modern: { heading: poppinsFont, body: interFont },
  elegante: { heading: loraFont, body: workSansFont },
  amigable: { heading: quicksandFont, body: nunitoFont },
  lujo: { heading: playfairFont, body: interFont },
  nocturno: { heading: bricolageFont, body: hankenFont },
} as const;

export type FontPairingKey = keyof typeof fontPairings;

export function getFontVariables(key: FontPairingKey): string {
  const pair = fontPairings[key];
  return `${pair.heading.variable} ${pair.body.variable}`;
}
