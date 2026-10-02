import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { db, jsonb, withDb } from "@/lib/db";
import type { SessionUser } from "@/lib/auth";

// Credenciales propias (usuario/contraseña), alternativa a Google y a la
// clave compartida — mismo patrón `settings` key/value que
// lib/mandagroup-store.ts: un solo row con la lista completa, no justifica
// una tabla propia a esta escala (un puñado de personas administrando).
//
// La contraseña NUNCA se guarda en texto plano — solo su hash (bcrypt, 12
// rounds). `verifyAdminCredential` es la única función que compara una
// contraseña real contra el hash, y lo hace con bcrypt.compare (resistente a
// timing attacks), nunca con un === directo.
//
// Alta de una cuenta nueva: `inviteAdmin` crea la cuenta SIN contraseña (la
// persona todavía no puede entrar) y devuelve un token de un solo uso. La
// persona entra a /eventos/admin/setup?token=... y ahí mismo escribe o genera
// su propia contraseña — nunca pasa por nosotros ni queda en este chat.

export interface AdminCredential {
  username: string;
  email: string;
  passwordHash: string | null;
  role: "admin" | "staff";
  setupToken: string | null;
  setupTokenExpiresAt: string | null;
}

const KEY = "admin_credentials";
const SETUP_TOKEN_TTL_MS = 48 * 60 * 60 * 1000; // 48 horas para crear la contraseña

// Política mínima de contraseña — se valida ACÁ, no solo en el formulario,
// para que quede forzada sin importar qué camino la llame (setup, rotación
// futura, un script). "Generar contraseña segura" del formulario ya cumple
// esto de sobra (20 caracteres con mayúsculas/minúsculas/números/símbolos).
export function passwordPolicyError(password: string): string | null {
  if (password.length < 12) return "La contraseña debe tener al menos 12 caracteres.";
  if (!/[a-z]/.test(password)) return "Debe incluir al menos una letra minúscula.";
  if (!/[A-Z]/.test(password)) return "Debe incluir al menos una letra mayúscula.";
  if (!/[0-9]/.test(password)) return "Debe incluir al menos un número.";
  return null;
}

const g = globalThis as unknown as { __adminCredentials?: AdminCredential[] };

function memory(): AdminCredential[] {
  if (!g.__adminCredentials) g.__adminCredentials = [];
  return g.__adminCredentials;
}

async function listCredentials(): Promise<AdminCredential[]> {
  return withDb(
    async () => {
      const sql = db();
      const rows = await sql`SELECT value FROM settings WHERE key = ${KEY} LIMIT 1`;
      return (rows[0]?.value as AdminCredential[] | undefined) ?? [];
    },
    () => memory()
  );
}

async function saveCredentials(list: AdminCredential[]): Promise<void> {
  await withDb(
    async () => {
      const sql = db();
      await sql`
        INSERT INTO settings (key, value) VALUES (${KEY}, ${jsonb(list)})
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
      `;
    },
    () => {
      g.__adminCredentials = list;
    }
  );
}

// Crea la cuenta SIN contraseña y devuelve el token de configuración — la
// contraseña la define la propia persona en /eventos/admin/setup?token=...,
// nunca pasa por quien invita.
export async function inviteAdmin(input: { username: string; email: string; role?: "admin" | "staff" }): Promise<string> {
  const setupToken = randomBytes(32).toString("hex");
  const list = await listCredentials();
  const next = list.filter((c) => c.username.toLowerCase() !== input.username.toLowerCase());
  next.push({
    username: input.username,
    email: input.email,
    passwordHash: null,
    role: input.role ?? "admin",
    setupToken,
    setupTokenExpiresAt: new Date(Date.now() + SETUP_TOKEN_TTL_MS).toISOString(),
  });
  await saveCredentials(next);
  return setupToken;
}

export async function findBySetupToken(token: string): Promise<AdminCredential | null> {
  if (!token) return null;
  const match = (await listCredentials()).find((c) => c.setupToken === token);
  if (!match || !match.setupTokenExpiresAt) return null;
  if (new Date(match.setupTokenExpiresAt).getTime() < Date.now()) return null;
  return match;
}

type SetupResult = { ok: true; user: SessionUser } | { ok: false; error: string };

// La persona invitada define su propia contraseña acá — primera vez que se
// guarda un hash para esa cuenta. El token se consume (no sirve dos veces).
export async function completeSetup(token: string, password: string): Promise<SetupResult> {
  const credential = await findBySetupToken(token);
  if (!credential) return { ok: false, error: "El link de configuración no es válido o ya expiró." };
  const policyError = passwordPolicyError(password);
  if (policyError) return { ok: false, error: policyError };

  const passwordHash = await bcrypt.hash(password, 12);
  const list = await listCredentials();
  const next = list.map((c) =>
    c.username === credential.username ? { ...c, passwordHash, setupToken: null, setupTokenExpiresAt: null } : c
  );
  await saveCredentials(next);
  return { ok: true, user: { email: credential.email, role: credential.role } };
}

// Para que la propia persona pueda rotar su contraseña ya sabiendo la
// anterior (a diferencia de inviteAdmin, que es solo para la primera vez).
export async function setAdminCredential(input: {
  username: string;
  email: string;
  password: string;
  role?: "admin" | "staff";
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const policyError = passwordPolicyError(input.password);
  if (policyError) return { ok: false, error: policyError };

  const passwordHash = await bcrypt.hash(input.password, 12);
  const list = await listCredentials();
  const next = list.filter((c) => c.username.toLowerCase() !== input.username.toLowerCase());
  next.push({ username: input.username, email: input.email, passwordHash, role: input.role ?? "admin", setupToken: null, setupTokenExpiresAt: null });
  await saveCredentials(next);
  return { ok: true };
}

export async function removeAdminCredential(username: string): Promise<void> {
  const list = await listCredentials();
  await saveCredentials(list.filter((c) => c.username.toLowerCase() !== username.toLowerCase()));
}

export async function listAdminCredentials(): Promise<Omit<AdminCredential, "passwordHash" | "setupToken">[]> {
  return (await listCredentials()).map(({ username, email, role, setupTokenExpiresAt }) => ({
    username,
    email,
    role,
    setupTokenExpiresAt,
    pendingSetup: setupTokenExpiresAt ? new Date(setupTokenExpiresAt).getTime() > Date.now() : false,
  }));
}

// `identifier` puede ser el username o el email indistintamente — pedido
// explícito: "que el login pueda ser por usuario o correo".
export async function verifyAdminCredential(identifier: string, password: string): Promise<SessionUser | null> {
  const lower = identifier.trim().toLowerCase();
  if (!lower || !password) return null;
  const list = await listCredentials();
  const match = list.find((c) => c.username.toLowerCase() === lower || c.email.toLowerCase() === lower);
  if (!match?.passwordHash) {
    // Sin credencial encontrada (o cuenta invitada que aún no creó su
    // contraseña), igual corremos un hash dummy: si solo las identidades
    // reales tardan en responder, eso ya filtra qué cuentas existen por
    // temporización.
    await bcrypt.compare(password, "$2a$12$CwTycUXWue0Thq9StjUM0uJ8i6NIxTFvi9mSGYaB6kJXx0a0.Qg4.");
    return null;
  }
  const ok = await bcrypt.compare(password, match.passwordHash);
  return ok ? { email: match.email, role: match.role } : null;
}

export async function findAdminCredentialByEmail(email: string): Promise<AdminCredential | null> {
  const lower = email.toLowerCase();
  return (await listCredentials()).find((c) => c.email.toLowerCase() === lower) ?? null;
}

export async function hasAnyAdminCredential(): Promise<boolean> {
  return (await listCredentials()).some((c) => c.passwordHash);
}
