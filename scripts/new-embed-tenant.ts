#!/usr/bin/env tsx
// Alta de un TENANT del asistente embebible. Genera el bloque de config listo
// para pegar en config/embed-tenants.ts (o lo inserta con --write), una clave de
// admin aleatoria, las variables de entorno a setear en Vercel, el snippet de
// instalación (una línea de <script>) y el link del panel del dueño.
//
// Uso:
//   npm run embed-tenant -- --id nails-color --name "Nails Color" \
//     --rubro "salón de uñas y pestañas" --whatsapp 56912345678 \
//     --email duena@correo.cl [--agenda] [--store] [--emojis] [--write]
//
// --agenda / --store agregan andamiaje (servicios/horarios/productos placeholder)
// para que el operador lo complete. --emojis activa emojis en las respuestas
// (off por defecto — no calza con todos los rubros). --write inserta el
// bloque en el archivo.
import { parseArgs } from "node:util";
import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const { values } = parseArgs({
  options: {
    id: { type: "string" },
    name: { type: "string" },
    rubro: { type: "string" },
    whatsapp: { type: "string" },
    email: { type: "string" },
    agenda: { type: "boolean", default: false },
    store: { type: "boolean", default: false },
    emojis: { type: "boolean", default: false },
    write: { type: "boolean", default: false },
  },
});

function die(msg: string): never {
  console.error(`✖ ${msg}`);
  process.exit(1);
}

const id = values.id?.trim();
const name = values.name?.trim();
const rubro = values.rubro?.trim();
if (!id || !name || !rubro) {
  die('Faltan datos. Mínimo: --id <kebab> --name "Negocio" --rubro "rubro". (--agenda --store --emojis --write opcionales)');
}
if (!/^[a-z0-9-]+$/.test(id)) die(`--id debe ser kebab-case (minúsculas, números y guiones). Recibí "${id}".`);

const envId = id.toUpperCase().replace(/[^A-Z0-9]+/g, "_");
const adminKey = randomBytes(18).toString("base64url");
const wa = values.whatsapp?.replace(/\D/g, "");
const q = (s: string) => JSON.stringify(s);

// --- Bloque de config del tenant ---
const lines: string[] = [];
lines.push(`  ${JSON.stringify(id)}: {`);
lines.push(`    id: ${q(id)},`);
lines.push(`    businessName: ${q(name)},`);
lines.push(`    rubro: ${q(rubro)},`);
lines.push(`    description: "Descripción breve del negocio (1-2 frases). COMPLETAR.",`);
lines.push(`    facts: [`);
lines.push(`      "Servicios/productos y precios. COMPLETAR.",`);
lines.push(`      "Horario de atención. COMPLETAR.",`);
lines.push(`      "Ubicación / cobertura. COMPLETAR.",`);
lines.push(`    ].join("\\n"),`);
if (wa) lines.push(`    whatsapp: ${q(wa)},`);
if (values.email) lines.push(`    ownerNotifyEmail: ${q(values.email)},`);
lines.push(`    model: ${q(values.agenda || values.store ? "gemini-2.5-flash" : "gemini-3.5-flash-lite")}, // flash para agenda/tienda (tools); lite basta para solo conversar`);
if (values.emojis) lines.push(`    useEmojis: true,`);
if (values.agenda) {
  lines.push(`    agenda: {`);
  lines.push(`      services: ["Servicio 1", "Servicio 2"], // COMPLETAR`);
  lines.push(`      hours: [`);
  lines.push(`        { day: "Lunes a viernes", open: "09:00", close: "18:00" }, // COMPLETAR`);
  lines.push(`        { day: "Sábado", closed: true },`);
  lines.push(`        { day: "Domingo", closed: true },`);
  lines.push(`      ],`);
  lines.push(`      slotMinutes: 60,`);
  lines.push(`      daysAhead: 14,`);
  lines.push(`    },`);
}
if (values.store) {
  lines.push(`    store: {`);
  lines.push(`      products: [`);
  lines.push(`        { slug: "producto-1", name: "Producto 1", price: 9990, description: "COMPLETAR" },`);
  lines.push(`      ],`);
  lines.push(`      shippingNote: "Retiro o despacho a coordinar. COMPLETAR.",`);
  lines.push(`    },`);
}
lines.push(`  },`);
const block = lines.join("\n");

// --- Salida ---
const origin = process.env.NEXT_PUBLIC_SITE_URL ?? "https://TU-APP.vercel.app";
console.log(`\n╭─ Tenant "${id}" (${name}) ─────────────────────────────\n`);
console.log("1) Bloque para config/embed-tenants.ts:\n");
console.log(block);
console.log("\n2) Variables de entorno en Vercel (secretos — NUNCA en el config):\n");
console.log(`   EMBED_ADMIN_KEY_${envId}=${adminKey}`);
if (values.store) {
  console.log(`   # Pago propio del cliente (opcional; sin esto usa integración = sin cobro real):`);
  console.log(`   # TBK_ENV_${envId}=produccion`);
  console.log(`   # TBK_COMMERCE_CODE_${envId}=<código de comercio del cliente>`);
  console.log(`   # TBK_API_KEY_${envId}=<llave secreta del cliente>`);
}
console.log("\n3) Instalación en el sitio del cliente (una línea):\n");
console.log(`   <script src="${origin}/widget.js" data-tenant="${id}" data-name="${name.replace(/"/g, "&quot;")}" data-color="#FF3D3D"></script>`);
console.log("\n4) Link del panel del dueño:\n");
console.log(`   ${origin}/embed/panel?t=${id}&clave=${adminKey}`);
console.log("\n╰────────────────────────────────────────────────────────\n");

// --- Inserción opcional ---
if (values.write) {
  const here = dirname(fileURLToPath(import.meta.url));
  const file = resolve(here, "../config/embed-tenants.ts");
  const src = readFileSync(file, "utf-8");
  const anchor = "// <nuevo-tenant-aquí>";
  const at = src.indexOf(anchor);
  if (at < 0) die(`No encontré el ancla "${anchor}" en embed-tenants.ts — pega el bloque a mano.`);
  if (new RegExp(`^\\s*${JSON.stringify(id)}:\\s*\\{`, "m").test(src)) {
    die(`Ya existe un tenant con id "${id}" en embed-tenants.ts.`);
  }
  // Insertar DESPUÉS de la línea completa del ancla (que puede tener texto extra).
  const lineEnd = src.indexOf("\n", at);
  const insertPos = lineEnd < 0 ? src.length : lineEnd;
  const next = src.slice(0, insertPos) + "\n" + block + src.slice(insertPos);
  writeFileSync(file, next);
  console.log(`✓ Insertado en config/embed-tenants.ts. Revisa los "COMPLETAR", corre npm run typecheck y commitea.`);
} else {
  console.log("(Corre con --write para insertar el bloque automáticamente en el archivo.)");
}
