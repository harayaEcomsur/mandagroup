#!/usr/bin/env tsx
// Fábrica de demos: una demo personalizada en UN comando, sin preguntas.
// Objetivo: demo lista (config + branch + deploy noindex) en ≤3 minutos de
// máquina, para que el costo humano por D0 sea solo juntar los datos del
// prospecto (~5-10 min) y no armar el sitio.
//
// Uso:
//   npm run demo -- --name "Corredora García" --rubro "corretaje de propiedades" \
//     --logo https://sitio.cl/logo.png --whatsapp 56912345678 --deploy
//
// Flags: --name (obligatorio) --rubro --logo <ruta|URL> --generate-logo
//        --whatsapp --phone --email --address --preset --layout --style
//        --deploy --no-branch
//
// Qué hace: preset+layout sugeridos por rubro → logo (descarga si es URL, o
// se genera con IA vía --generate-logo si el prospecto no tiene uno — usa el
// plugin ui-ux-pro-max de Claude Code, requiere GEMINI_API_KEY) → paleta WCAG
// + variantes A/B/C → nombre real en TODO el copy + contacto + SEO →
// BRIEF.md → branch demo/<slug> (y vuelve al branch original) → deploy
// opcional a Vercel como demo-<slug> con SITE_NOINDEX=1.
import { parseArgs } from "node:util";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";
import {
  slugify,
  suggestLayout,
  suggestPreset,
  applyIdentity,
  applyLogoAndPalette,
  generateLogoWithAi,
} from "./wizard-core";

const { values } = parseArgs({
  options: {
    name: { type: "string" },
    rubro: { type: "string" },
    logo: { type: "string" },
    whatsapp: { type: "string" },
    phone: { type: "string" },
    email: { type: "string" },
    address: { type: "string" },
    preset: { type: "string" },
    layout: { type: "string" },
    style: { type: "string" },
    deploy: { type: "boolean", default: false },
    "no-branch": { type: "boolean", default: false },
    "generate-logo": { type: "boolean", default: false },
  },
});

function fail(msg: string): never {
  console.error(`✖ ${msg}`);
  process.exit(1);
}

function run(cmd: string, opts: { quiet?: boolean } = {}): string {
  return execSync(cmd, { stdio: opts.quiet ? ["ignore", "pipe", "pipe"] : "inherit", encoding: "utf-8" }) as string;
}

async function downloadLogo(url: string, slug: string): Promise<string> {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) fail(`No se pudo descargar el logo (${res.status}): ${url}`);
  const type = res.headers.get("content-type") ?? "";
  const extFromUrl = path.extname(new URL(url).pathname).toLowerCase();
  const ext = [".png", ".jpg", ".jpeg", ".svg", ".webp"].includes(extFromUrl)
    ? extFromUrl
    : type.includes("svg")
      ? ".svg"
      : type.includes("jpeg")
        ? ".jpg"
        : type.includes("webp")
          ? ".webp"
          : ".png";
  const dir = path.join(process.cwd(), "public", "clients", slug);
  mkdirSync(dir, { recursive: true });
  const dest = path.join(dir, `logo${ext}`);
  writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
  console.log(`✔ Logo descargado → ${path.relative(process.cwd(), dest)}`);
  return dest;
}

async function main() {
  const businessName = values.name ?? fail("Falta --name");
  const rubro = values.rubro ?? "";
  const slug = slugify(businessName);
  const layout = values.layout ?? suggestLayout(rubro);
  const preset = values.preset ?? suggestPreset(rubro);

  const presetFile = path.join(process.cwd(), "config", "presets", `${preset}.config.ts`);
  if (!existsSync(presetFile)) fail(`No existe el preset "${preset}" en config/presets/`);

  console.log(`\n═══ Fábrica de demos — ${businessName} ═══`);
  console.log(`preset: ${preset} · layout: ${layout} · slug: ${slug}\n`);

  // --- config: preset → export activo → identidad real en todo el copy ---
  let content = readFileSync(presetFile, "utf-8")
    .replace(/const clientConfig = defineClientConfig\(/, "export const clientConfig = defineClientConfig(")
    .replace(/\nexport default clientConfig;\n?/, "\n");
  content = applyIdentity(content, {
    businessName,
    slug,
    rubro,
    style: values.style,
    layout,
    whatsapp: values.whatsapp,
    phone: values.phone,
    email: values.email,
    address: values.address,
  });

  // --- logo: ruta local, URL, o generado con IA (ui-ux-pro-max) si no hay ninguno ---
  let paletteNote = "- (sin logo: paleta del preset — correr `npm run palette` cuando llegue)";
  let logoSource = values.logo;
  let logoGenNote: string | null = null;
  if (!logoSource && values["generate-logo"]) {
    console.log("Generando logo placeholder con IA (ui-ux-pro-max)…");
    const gen = generateLogoWithAi(businessName, rubro, values.style, slug);
    logoGenNote = gen.note;
    console.log(gen.note.replace(/^- /, ""));
    if (gen.path) logoSource = gen.path;
  }
  if (logoSource) {
    const logoLocal = /^https?:\/\//.test(logoSource) ? await downloadLogo(logoSource, slug) : logoSource;
    const r = applyLogoAndPalette(content, slug, logoLocal);
    content = r.content;
    paletteNote = logoGenNote ? `${logoGenNote}\n${r.note}` : r.note;
  } else if (logoGenNote) {
    paletteNote = `${logoGenNote}\n${paletteNote}`;
  }

  writeFileSync(path.join(process.cwd(), "config", "client.config.ts"), content, "utf-8");
  console.log(`✔ Config listo (nombre real aplicado a todo el copy)`);

  const brief = `# Brief DEMO — ${businessName}

- **Rubro:** ${rubro || "(por definir)"} · **Preset:** ${preset} · **Layout:** ${layout}
- **Contacto:** ${values.whatsapp ?? "(pendiente)"} ${values.email ? `· ${values.email}` : ""}
${paletteNote}

> Demo de prospección (D0). Generada por la fábrica: el copy usa la estructura
> del preset con el nombre real. Antes de enviar: (1) mirar la home 30 segundos,
> (2) si hay dato distintivo del prospecto (años, especialidad, comuna), tocarlo
> en hero/nosotros — 2 minutos máximo. Personalización profunda: solo si compra.

## Pendientes si compra
- [ ] Copy real (historia, servicios, precios) + fotos del negocio
- [ ] Datos de contacto completos + FAQ + chat qaPairs con info real
- [ ] Dominio propio y quitar SITE_NOINDEX
`;
  writeFileSync(path.join(process.cwd(), "BRIEF.md"), brief, "utf-8");
  console.log("✔ BRIEF.md (versión demo)");

  // --- branch demo/<slug>, y de vuelta al branch original para la siguiente demo ---
  let branchName = "";
  let originalBranch = "";
  if (!values["no-branch"]) {
    try {
      originalBranch = run("git rev-parse --abbrev-ref HEAD", { quiet: true }).trim();
      branchName = `demo/${slug}`;
      run(`git checkout -b ${branchName}`, { quiet: true });
      run("git add config/client.config.ts BRIEF.md public/clients", { quiet: true });
      run(`git commit -m "Demo: ${businessName}" --quiet`, { quiet: true });
      console.log(`✔ Branch ${branchName} creado`);
    } catch {
      console.warn("⚠ No se pudo crear el branch — la config queda en el working tree.");
    }
  }

  // --- deploy opcional: proyecto demo-<slug>, siempre noindex ---
  if (values.deploy) {
    // Fijo, no ambiental: sin --scope explícito, `vercel link` en un checkout sin
    // .vercel/ previo cae al scope activo de quien corra el script, y puede
    // auto-vincular por fuzzy-match del nombre de carpeta a un proyecto AJENO
    // (nos pasó dos veces linkeando a "starter-kit" en vez del proyecto del
    // cliente). Verificamos además el link resultante antes de desplegar.
    const VERCEL_TEAM = "team_sLVBByRK59490BHw2v3RZGtn"; // harayaecomsurs-projects
    const expectedProject = `demo-${slug}`;
    try {
      console.log(`\nDesplegando a Vercel como ${expectedProject} (noindex)…`);
      run(`vercel link --yes --project ${expectedProject} --scope ${VERCEL_TEAM}`, { quiet: true });
      const linked = JSON.parse(readFileSync(path.join(process.cwd(), ".vercel", "project.json"), "utf-8"));
      if (linked.projectName !== expectedProject) {
        fail(
          `vercel link quedó apuntando a "${linked.projectName}", no a "${expectedProject}" — abortado antes de desplegar al proyecto equivocado.`
        );
      }
      try {
        execSync(`vercel env add SITE_NOINDEX production --scope ${VERCEL_TEAM}`, {
          input: "1\n",
          stdio: ["pipe", "ignore", "ignore"],
        });
      } catch {
        // ya existía — da lo mismo, lo importante es que esté
      }
      const out = run(`vercel deploy --prod --yes --scope ${VERCEL_TEAM}`, { quiet: true }).trim();
      const url = out.split("\n").filter(Boolean).pop();
      console.log(`✔ Demo publicada: ${url}`);
    } catch (e) {
      console.warn(
        `⚠ Deploy falló — correr a mano: vercel link --yes --project ${expectedProject} --scope ${VERCEL_TEAM} && vercel deploy --prod --yes --scope ${VERCEL_TEAM}`
      );
    }
  }

  if (branchName && originalBranch) {
    try {
      run(`git checkout ${originalBranch}`, { quiet: true });
      console.log(`✔ De vuelta en ${originalBranch} — lista para la siguiente demo`);
    } catch {
      console.warn(`⚠ Quedaste en ${branchName}; vuelve con: git checkout ${originalBranch}`);
    }
  }

  console.log(`\nSiguiente demo: npm run demo -- --name "…" --rubro "…" --logo <url> --whatsapp 569… --deploy`);
}

main();
