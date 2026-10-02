#!/usr/bin/env tsx
// Wizard de cliente nuevo. Premisa del starter-kit: ninguna demo genérica —
// cada cliente recibe un toque de personalización (layout según su rubro,
// paleta desde su logo, referencias de inspiración registradas en un BRIEF.md).
//
// Uso interactivo:   npm run new-client
// No interactivo:    npm run new-client -- --name "Panadería Rosita" [--preset restaurante]
//                    (salta las preguntas que ya respondiste por flag)
import { parseArgs } from "node:util";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import readline from "node:readline/promises";
import path from "node:path";
import { slugify, suggestLayout, suggestPreset, applyIdentity, applyLogoAndPalette } from "./wizard-core";

// Google OAuth es el login ESTÁNDAR del panel admin (Agenda/Tienda/Inmobiliaria)
// para cualquier cliente nuevo — no un extra que se agrega después si alguien
// se acuerda. Un solo Client ID de Google Cloud sirve para TODOS los clientes:
// solo hay que agregar el dominio de cada uno a sus "Authorized JavaScript
// origins" (Google Cloud Console → Credentials). Nunca crear un Client ID
// nuevo por cliente.
const SHARED_GOOGLE_CLIENT_ID = "834236700440-pcn8iq8f7o3urdih2jtnr05uc97aanj0.apps.googleusercontent.com";

const { values } = parseArgs({
  options: {
    name: { type: "string" },
    preset: { type: "string" },
    logo: { type: "string" },
    layout: { type: "string" },
  },
});

// El async iterator bufferiza las líneas internamente, así el wizard funciona
// igual en TTY que con respuestas por pipe (rl.question pierde líneas en pipes).
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const lineIter = rl[Symbol.asyncIterator]();

async function ask(question: string, fallback = ""): Promise<string> {
  process.stdout.write(question);
  const { value, done } = await lineIter.next();
  const answer = done ? "" : String(value).trim();
  if (!process.stdin.isTTY) console.log(answer); // eco para logs cuando viene por pipe
  return answer || fallback;
}

async function main() {
  console.log("\n═══ Cliente nuevo — starter-kit ═══");
  console.log("Premisa: nada genérico. Un par de preguntas para darle su toque.\n");

  const businessName = values.name ?? (await ask("Nombre del negocio: "));
  if (!businessName) {
    console.error("El nombre es obligatorio.");
    process.exit(1);
  }
  const slug = slugify(businessName);

  const rubro = await ask("Rubro (ej: corretaje de propiedades, estudio jurídico, restaurante): ");

  const layoutSuggested = (values.layout as ReturnType<typeof suggestLayout>) || suggestLayout(rubro);
  const layout =
    (await ask(
      `Layout [clasico | inmobiliaria | corporativo] (sugerido por rubro: ${layoutSuggested}): `,
      layoutSuggested
    )) || layoutSuggested;

  const presetSuggested = values.preset ?? suggestPreset(rubro);
  const preset = await ask(
    `Preset base [restaurante | barberia | profesional | _template] (sugerido: ${presetSuggested}): `,
    presetSuggested
  );

  const logoPath = values.logo ?? (await ask("Ruta al logo del cliente (enter si aún no hay): "));

  const inspiration = await ask(
    "Sitios de inspiración/competencia (URLs separadas por coma, enter si ninguna): "
  );

  const style = await ask("Estilo tipográfico [modern | elegante | amigable] (enter = según preset): ");

  let colorNotes = "";
  if (!logoPath) {
    colorNotes = await ask("Colores preferidos del cliente (ej: 'verde y dorado', enter si no sabe): ");
  }

  // Contexto del negocio: alimenta el copy, el chat y el SEO de la demo. La
  // cobertura por defecto es todo Chile — solo se acota si el cliente lo dice.
  const historia = await ask("Contexto del negocio (historia, años, qué lo distingue — 1-2 líneas): ");
  const serviciosNotas = await ask("Servicios principales (separados por coma, enter = los del preset): ");
  const cobertura = await ask("Zonas de cobertura (enter = todo Chile; indica base/ciudad si la hay): ", "todo Chile");

  const adminEmail = await ask(
    "Correo Google del dueño para /agenda/admin y /tienda/admin (login con Google es el estándar — enter si aún no lo tienes, se agrega después): "
  );

  rl.close();

  // Se genera SIEMPRE que hay correo, aunque el proyecto de Vercel del cliente
  // todavía no exista en este paso — así el comando queda listo para copiar y
  // pegar en cuanto se cree el proyecto, en vez de tener que acordarse de
  // volver a generarlo.
  const sessionSecret = adminEmail ? randomBytes(24).toString("base64url") : "";

  // --- config desde el preset ---
  const presetFile = path.join(process.cwd(), "config", "presets", `${preset}.config.ts`);
  if (!existsSync(presetFile)) {
    console.error(`No existe el preset "${preset}" en config/presets/`);
    process.exit(1);
  }
  // Los presets exportan default; la config activa debe exportar `clientConfig`.
  let content = readFileSync(presetFile, "utf-8")
    .replace(/const clientConfig = defineClientConfig\(/, "export const clientConfig = defineClientConfig(")
    .replace(/\nexport default clientConfig;\n?/, "\n");
  // Identidad real en meta + TODO el copy del preset (lib compartida con la fábrica).
  content = applyIdentity(content, { businessName, slug, rubro, style, layout });

  // Login con Google del panel de admin (ver lib/auth.ts) — se agrega el
  // bloque justo después de `meta`, que todo preset trae. Sin correo, el panel
  // sigue funcionando solo con AGENDA_ADMIN_KEY hasta que se complete a mano.
  if (adminEmail) {
    content = content.replace(
      /(meta:\s*\{[\s\S]*?\n  \},\n)/,
      `$1\n  admin: {\n    users: [{ email: "${adminEmail}", role: "admin" }],\n  },\n`
    );
  }

  // --- paleta desde el logo, si hay ---
  let paletteBlock = "";
  if (logoPath && existsSync(logoPath)) {
    const r = applyLogoAndPalette(content, slug, logoPath);
    content = r.content;
    paletteBlock = r.note;
  }

  writeFileSync(path.join(process.cwd(), "config", "client.config.ts"), content, "utf-8");
  console.log(`\n✔ Config creado en config/client.config.ts (preset ${preset}, layout ${layout})`);

  // --- BRIEF.md: las respuestas y referencias viven en el branch del cliente ---
  const brief = `# Brief — ${businessName}

- **Rubro:** ${rubro || "(por definir)"}
- **Layout:** ${layout}
- **Estilo tipográfico:** ${style || "(el del preset)"}
- **Logo:** ${logoPath ? `public/clients/${slug}/` : "(pendiente — pedir al cliente; luego correr npm run palette)"}
${paletteBlock ? paletteBlock + "\n" : ""}${colorNotes ? `- **Colores preferidos:** ${colorNotes}\n` : ""}
## Contexto del negocio

- **Historia / diferenciales:** ${historia || "(por completar con el cliente)"}
- **Servicios principales:** ${serviciosNotas || "(los del preset — validar con el cliente)"}
- **Cobertura:** ${cobertura}${cobertura === "todo Chile" ? " (default — confirmar si tiene base/zona principal)" : ""}

> Usar este contexto en el copy del hero/nosotros, las FAQ, el prompt del chat
> (businessDescription y qaPairs) y el SEO. Si la cobertura tiene una base o zona
> principal, dale jerarquía en el copy (ej: "base en X, especialista en Y, con
> operación en todo Chile").

## Inspiración / competencia

${
  inspiration
    ? inspiration
        .split(",")
        .map((u) => `- ${u.trim()}`)
        .join("\n")
    : "- (ninguna registrada)"
}

> Al armar la demo: revisar estas referencias y rescatar **1 o 2 detalles
> distintivos** (estructura del hero, cómo presentan el servicio estrella, tono
> del copy). La premisa es que ningún cliente reciba una demo genérica.

## Pendientes

- [ ] Volcar el contexto del negocio (historia, servicios, cobertura) al copy, chat y SEO del config
- [ ] Completar datos reales en config/client.config.ts (contacto, precios, FAQ, chat)
- [ ] Fotos reales o de stock acordes al rubro en public/clients/${slug}/
- [ ] ${logoPath ? "Confirmar variante de diseño elegida por el cliente (/variantes)" : "Conseguir el logo y correr: npm run palette -- <logo>"}
- [ ] Revisar la demo contra las referencias de inspiración
- [ ] ${
    adminEmail
      ? `Panel admin — login con Google (estándar): agregar el dominio real de este cliente a "Authorized JavaScript origins" del Client ID compartido en Google Cloud Console, y correr los comandos de \`vercel env add\` de más abajo (ver "Próximos pasos")`
      : "Pedir el correo Google del dueño y agregarlo a admin.users en client.config.ts — después correr npm run new-client de nuevo no hace falta, basta con setear NEXT_PUBLIC_GOOGLE_CLIENT_ID + SESSION_SECRET en Vercel (mismo Client ID compartido)"
  }
- [ ] Si el negocio tiene más de una persona atendiendo (varios barberos/peluqueras), agregarlas a admin.users con role: "staff" — solo gestionan reservas y bloqueos, no la configuración del negocio
`;
  writeFileSync(path.join(process.cwd(), "BRIEF.md"), brief, "utf-8");
  console.log("✔ BRIEF.md creado con las respuestas e inspiraciones");

  // --- branch de git ---
  const branchName = `client/${slug}`;
  try {
    execSync("git rev-parse --is-inside-work-tree", { stdio: "ignore" });
    execSync(`git checkout -b ${branchName}`, { stdio: "inherit" });
    execSync("git add config/client.config.ts BRIEF.md public/clients", { stdio: "inherit" });
    execSync(`git commit -m "Nuevo cliente: ${businessName}"`, { stdio: "inherit" });
    console.log(`✔ Branch "${branchName}" creado con config + brief`);
  } catch {
    console.warn("⚠ No se pudo crear el branch de git automáticamente. Puedes crearlo manualmente.");
  }

  console.log(`
Próximos pasos:
1. Revisa BRIEF.md y las referencias de inspiración antes de tocar el diseño
2. Completa los datos reales en config/client.config.ts
3. Agrega imágenes en public/clients/${slug}/
4. npm run dev y revisa la demo (y /variantes si hay logo)
`);

  if (adminEmail) {
    console.log(`5. Cuando exista el proyecto de Vercel de este cliente, login con Google (comandos listos, mismo Client ID compartido de siempre):

   vercel env add NEXT_PUBLIC_GOOGLE_CLIENT_ID production
   ${SHARED_GOOGLE_CLIENT_ID}

   vercel env add SESSION_SECRET production
   ${sessionSecret}

   Y en Google Cloud Console → Credentials → ese Client ID → "Authorized JavaScript origins": agregar el dominio real de ${businessName}.
`);
  }
}

main();
