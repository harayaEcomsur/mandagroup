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

const interFont = Inter({ subsets: ["latin"], variable: "--font-body" });
const poppinsFont = Poppins({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-heading" });

const loraFont = Lora({ subsets: ["latin"], variable: "--font-heading" });
const workSansFont = Work_Sans({ subsets: ["latin"], variable: "--font-body" });

const quicksandFont = Quicksand({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-heading" });
const nunitoFont = Nunito({ subsets: ["latin"], variable: "--font-body" });

// Playfair Display + Inter: par recomendado por ui-ux-pro-max (--design-system
// "beauty salon hair services elegant") para belleza/spa/lujo — serif editorial
// de más carácter que Lora, para rubros que piden "elegante CON estilo", no solo
// prolijo (ver README → "Diseño distintivo por cliente").
const playfairFont = Playfair_Display({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-heading" });

// Bricolage Grotesque + Hanken Grotesk: sans de display con carácter (no la
// serif "de lujo" por defecto) para marcas nocturnas/corporativas — un
// holding de clubes y restaurantes se lee moderno y seguro, no editorial.
const bricolageFont = Bricolage_Grotesque({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-heading" });
const hankenFont = Hanken_Grotesk({ subsets: ["latin"], variable: "--font-body" });

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
