// Lógica compartida entre el wizard interactivo (new-client) y la fábrica de
// demos no interactiva (new-demo): slug, sugerencias por rubro, y las
// transformaciones de config (identidad + paleta desde el logo).
import { existsSync, mkdirSync, copyFileSync } from "node:fs";
import { execSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import {
  extractColors,
  pickPalette,
  ensureContrastWithWhite,
  hexToRgb,
  rgbToHex,
  hslToRgb,
} from "./palette-core";

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// El layout es lo primero que evita que todo se vea igual: se sugiere por rubro.
// Si un rubro nuevo no calza bien con ninguno de estos, la respuesta correcta
// no es forzarlo a "clasico" — es crear un layout nuevo (ver components/layouts/,
// mismo patrón que "salud") antes de mandar la demo.
export function suggestLayout(rubro: string): "inmobiliaria" | "corporativo" | "salud" | "belleza" | "clasico" {
  const r = rubro.toLowerCase();
  if (/(inmobili|propiedad|corretaje|corredor)/.test(r)) return "inmobiliaria";
  if (/(abogad|juridic|jurídic|legal|contab|contador|consultor|auditor|notari|arquitect|ingenier)/.test(r))
    return "corporativo";
  if (/(dental|dentist|odontolog|clinica|clínica|medic|salud|kinesiolog|nutricion|nutrición|psicolog)/.test(r))
    return "salud";
  // Mismo split que suggestPreset: "estética" salón (belleza) vs. clínica de
  // salud ya quedó cubierto arriba — acá van salón/spa/peluquería/uñas.
  if (/(peluquer|estetic|estétic|salon|salón|spa|manicur|uñas|nails|belleza)/.test(r)) return "belleza";
  return "clasico";
}

// Estilo de logo para el generador de ui-ux-pro-max (--style), a partir del
// mismo fontPairing que ya elige el cliente para el resto del sitio.
export function suggestLogoStyle(fontPairing?: string): "luxury" | "modern" | "playful" {
  if (fontPairing === "modern") return "modern";
  if (fontPairing === "amigable") return "playful";
  return "luxury"; // "elegante", "lujo" y default
}

// Industria para el generador de logos (--industry) — vocabulario CERRADO del
// plugin (tech/healthcare/finance/food/fashion/fitness/eco/education/
// real-estate/creative), distinto del rubro libre del negocio. undefined
// cuando el rubro no calza claramente con ninguna: mejor omitir --industry
// que forzar una categoría que no corresponde.
export function suggestLogoIndustry(rubro: string): string | undefined {
  const r = rubro.toLowerCase();
  if (/(inmobili|propiedad|corretaje|corredor)/.test(r)) return "real-estate";
  if (/(dental|dentist|odontolog|clinica|clínica|medic|salud|kinesiolog|nutricion|nutrición|psicolog)/.test(r))
    return "healthcare";
  if (/(restauran|comida|food|cafe|café|pasteler|panader|sushi|pizz)/.test(r)) return "food";
  if (/(barber|peluquer|estetic|estétic|salon|salón|spa|manicur|uñas|nails|moda|ropa)/.test(r)) return "fashion";
  if (/(gimnasio|fitness|crossfit|entrenador|personal trainer)/.test(r)) return "fitness";
  if (/(colegio|escuela|academia|instituto|curso)/.test(r)) return "education";
  if (/(software|tecnolog|desarroll|app\b|saas)/.test(r)) return "tech";
  return undefined;
}

export function suggestPreset(rubro: string): string {
  const r = rubro.toLowerCase();
  if (/(inmobili|propiedad|corretaje|corredor)/.test(r)) return "inmobiliaria";
  if (/(restauran|comida|food|cafe|café|pasteler|panader|sushi|pizz|brownie|dulce|tienda|almacen|almacén)/.test(r))
    return "restaurante";
  // "barberia" es masculino a propósito (Corte clásico, Afeitado tradicional)
  // — un salón de belleza, spa o estudio de uñas usa "belleza" en cambio, con
  // su propio tono, paleta y tipografía (ver config/presets/belleza.config.ts
  // y README → "Diseño distintivo por cliente").
  if (/(barber)/.test(r)) return "barberia";
  if (/(peluquer|estetic|estétic|salon|salón|spa|manicur|uñas|nails|belleza)/.test(r)) return "belleza";
  if (/(abogad|jurid|juríd|contab|contador|consultor)/.test(r)) return "profesional";
  return "_template";
}

export interface Identity {
  businessName: string;
  slug: string;
  rubro?: string;
  style?: string;
  layout?: string;
  whatsapp?: string; // solo dígitos, ej. 56912345678
  phone?: string;
  email?: string;
  address?: string;
}

// Aplica la identidad del cliente sobre el contenido de un preset:
// meta + reemplazo del nombre del negocio EN TODO EL COPY (hero, nosotros,
// chat, mensajes de WhatsApp…) + contacto + SEO. Esto es lo que antes se hacía
// a mano y costaba la mayor parte de los minutos por demo.
export function applyIdentity(content: string, id: Identity): string {
  // Nombre original del preset, para reemplazarlo en todo el copy.
  const originalName = content.match(/businessName:\s*"([^"]*)"/)?.[1];

  let out = content
    .replace(/slug:\s*"[^"]*"/, `slug: "${id.slug}"`)
    .replace(/businessName:\s*"[^"]*"/, `businessName: "${id.businessName}"`);
  if (id.rubro) out = out.replace(/rubro:\s*"[^"]*"/, `rubro: "${id.rubro}"`);
  if (id.style) out = out.replace(/fontPairing:\s*"[^"]*"/, `fontPairing: "${id.style}"`);
  if (id.layout && !out.includes("layout:")) {
    out = out.replace(/fontPairing:\s*"([^"]*)",/, `fontPairing: "$1",\n    layout: "${id.layout}",`);
  }

  // El copy del preset menciona el negocio ficticio muchas veces — todas pasan
  // a ser el negocio real. (Los paths de assets usan el slug del preset, no el
  // nombre, así que no se rompen.)
  if (originalName && originalName !== id.businessName) {
    out = out.split(originalName).join(id.businessName);
  }

  if (id.whatsapp) {
    const digits = id.whatsapp.replace(/\D/g, "");
    out = out.replace(/whatsapp:\s*"[^"]*"/, `whatsapp: "${digits}"`);
    if (!id.phone) {
      const pretty = digits.startsWith("56")
        ? `+56 ${digits.slice(2, 3)} ${digits.slice(3, 7)} ${digits.slice(7)}`
        : `+${digits}`;
      out = out.replace(/phone:\s*"[^"]*"/, `phone: "${pretty}"`);
    }
  }
  if (id.phone) out = out.replace(/phone:\s*"[^"]*"/, `phone: "${id.phone}"`);
  if (id.email) out = out.replace(/email:\s*"[^"]*"/, `email: "${id.email}"`);
  if (id.address) {
    out = out
      .replace(/address:\s*"[^"]*"/, `address: "${id.address}"`)
      .replace(/mapQuery:\s*"[^"]*"/, `mapQuery: "${id.address}, Chile"`);
  }

  // SEO coherente con el negocio real (solo dentro del bloque seo:).
  if (id.rubro) {
    out = out.replace(/(seo:\s*\{[\s\S]*?title:\s*)"[^"]*"/, `$1"${id.businessName} — ${cap(id.rubro)}"`);
  }
  return out;
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export interface PaletteResult {
  content: string;
  note: string;
}

// Copia el logo a public/clients/<slug>/, extrae la paleta y escribe
// branding + variantes A/B/C en el config. Compartido por wizard y fábrica.
export function applyLogoAndPalette(content: string, slug: string, logoPath: string): PaletteResult {
  if (!existsSync(logoPath)) return { content, note: `- ⚠ Logo no encontrado en ${logoPath}.` };

  const assetsDir = path.join(process.cwd(), "public", "clients", slug);
  mkdirSync(assetsDir, { recursive: true });
  const ext = path.extname(logoPath).toLowerCase() || ".png";
  const logoDest = path.join(assetsDir, `logo${ext}`);
  if (path.resolve(logoPath) !== path.resolve(logoDest)) copyFileSync(logoPath, logoDest);

  try {
    const p = pickPalette(extractColors(logoDest));
    const accentAsPrimary = ensureContrastWithWhite(hexToRgb(p.accent)!);
    const darkBg = hslToRgb(p.baseHsl.h, 0.3, 0.1);
    const darkPrimary = ensureContrastWithWhite(hslToRgb(p.baseHsl.h, Math.max(p.baseHsl.s, 0.5), 0.45));
    // Si el preset ya traía variantes de ejemplo, se reemplazan por las del
    // logo real (dejar ambas duplicaría la propiedad y rompe el typecheck).
    let out = content
      .replace(/\n  themeVariants: \[[\s\S]*?\n  \],\n/, "\n")
      .replace(/logoUrl:\s*"[^"]*"/, `logoUrl: "/clients/${slug}/logo${ext}"`)
      .replace(/faviconUrl:\s*"[^"]*"/, `faviconUrl: "/clients/${slug}/logo${ext}"`)
      .replace(/primary:\s*"[^"]*"/, `primary: "${p.primary}"`)
      .replace(/accent:\s*"[^"]*"/, `accent: "${p.accent}"`)
      .replace(/background:\s*"[^"]*"/, `background: "${p.background}"`)
      .replace(/foreground:\s*"[^"]*"/, `foreground: "${p.foreground}"`);
    const variants = `
  themeVariants: [
    { id: "a", name: "Fiel al logo", palette: { primary: "${p.primary}", accent: "${p.accent}", background: "${p.background}", foreground: "${p.foreground}" } },
    { id: "b", name: "Acento protagonista", palette: { primary: "${rgbToHex(accentAsPrimary.color)}", accent: "${p.primary}", background: "${rgbToHex(hslToRgb(p.accentHsl.h, 0.18, 0.98))}", foreground: "${p.foreground}" } },
    { id: "c", name: "Modo oscuro", palette: { primary: "${rgbToHex(darkPrimary.color)}", accent: "${p.accent}", background: "${rgbToHex(darkBg)}", foreground: "#F4F2EF" } },
  ],
`;
    out = out.replace(/\n  seo: \{/, `${variants}\n  seo: {`);
    const note = `- Paleta extraída del logo: primary ${p.primary}, accent ${p.accent}${
      p.primaryAdjusted ? ` (primary oscurecido desde ${p.primaryOriginal} por contraste WCAG)` : ""
    }\n- Variantes A/B/C generadas — enviar /variantes al cliente para que elija.`;
    return { content: out, note };
  } catch {
    return { content, note: "- ⚠ No se pudo extraer paleta del logo (¿blanco y negro?). Elegir a mano." };
  }
}

// Busca el generador de logos del plugin ui-ux-pro-max de Claude Code
// (nextlevelbuilder/ui-ux-pro-max-skill), instalado como plugin del usuario —
// no es una dependencia del repo, por eso se busca en el cache de plugins en
// vez de importarse como paquete. Si no está instalado, null.
function findLogoGeneratorScript(): string | null {
  try {
    const out = execSync(
      `find "${os.homedir()}/.claude/plugins/cache" -path "*/skills/design/scripts/logo/generate.py" 2>/dev/null | head -1`,
      { encoding: "utf-8" }
    ).trim();
    return out || null;
  } catch {
    return null;
  }
}

export interface LogoGenResult {
  path: string | null;
  note: string;
}

// Genera un logo placeholder con ui-ux-pro-max (Gemini "Nano Banana") cuando
// el prospecto todavía no tiene marca real — el resultado se pasa por el
// MISMO pipeline de paleta que un logo real (applyLogoAndPalette), así que la
// demo queda con colores propios en vez de la paleta genérica del preset.
// Nunca bloquea la demo: si el plugin no está instalado o falta
// GEMINI_API_KEY, devuelve null y explica por qué en `note`.
export function generateLogoWithAi(
  businessName: string,
  rubro: string,
  fontPairing: string | undefined,
  slug: string
): LogoGenResult {
  const script = findLogoGeneratorScript();
  if (!script) {
    return {
      path: null,
      note: "- ⚠ Plugin ui-ux-pro-max no encontrado — instalar con `/plugin marketplace add nextlevelbuilder/ui-ux-pro-max-skill` y `/plugin install ui-ux-pro-max@ui-ux-pro-max-skill`, o pasar --logo a mano.",
    };
  }
  if (!process.env.GEMINI_API_KEY) {
    return { path: null, note: "- ⚠ Falta GEMINI_API_KEY en el entorno para generar el logo con IA — pasar --logo a mano." };
  }

  const dir = path.join(process.cwd(), "public", "clients", slug);
  mkdirSync(dir, { recursive: true });
  const output = path.join(dir, "logo-ai.png");
  const style = suggestLogoStyle(fontPairing);
  const industry = suggestLogoIndustry(rubro);
  const esc = (s: string) => s.replace(/"/g, '\\"');
  const args = [
    `--brand "${esc(businessName)}"`,
    `--style ${style}`,
    industry ? `--industry ${industry}` : "",
    rubro ? `--brand-context "${esc(rubro)}"` : "",
    `--output "${output}"`,
  ]
    .filter(Boolean)
    .join(" ");

  try {
    execSync(`python3 "${script}" ${args}`, { stdio: "inherit" });
    if (!existsSync(output)) {
      return { path: null, note: "- ⚠ El generador de logos no produjo un archivo — revisar a mano o pasar --logo." };
    }
    return {
      path: output,
      note: `- ✔ Logo generado con IA (ui-ux-pro-max, estilo "${style}"${industry ? `, industria "${industry}"` : ""}) — revisar antes de enviar.`,
    };
  } catch {
    return {
      path: null,
      note: "- ⚠ Falló la generación de logo con IA (revisar deps: google-genai, pillow) — pasar --logo a mano.",
    };
  }
}
