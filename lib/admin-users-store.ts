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

export interface AdminCredential {
  username: string;
  email: string;
  passwordHash: string;
  role: "admin" | "staff";
}

const KEY = "admin_credentials";

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

// Crea o reemplaza la credencial de un usuario (por username) — usado para
// dar de alta la primera cuenta y para que, más adelante, el propio dueño
// pueda rotar su contraseña sin pedírmela a mí.
export async function setAdminCredential(input: {
  username: string;
  email: string;
  password: string;
  role?: "admin" | "staff";
}): Promise<void> {
  const passwordHash = await bcrypt.hash(input.password, 12);
  const list = await listCredentials();
  const next = list.filter((c) => c.username.toLowerCase() !== input.username.toLowerCase());
  next.push({ username: input.username, email: input.email, passwordHash, role: input.role ?? "admin" });
  await saveCredentials(next);
}

export async function removeAdminCredential(username: string): Promise<void> {
  const list = await listCredentials();
  await saveCredentials(list.filter((c) => c.username.toLowerCase() !== username.toLowerCase()));
}

export async function listAdminCredentials(): Promise<Omit<AdminCredential, "passwordHash">[]> {
  return (await listCredentials()).map(({ username, email, role }) => ({ username, email, role }));
}

// `identifier` puede ser el username o el email indistintamente — pedido
// explícito: "que el login pueda ser por usuario o correo".
export async function verifyAdminCredential(identifier: string, password: string): Promise<SessionUser | null> {
  const lower = identifier.trim().toLowerCase();
  if (!lower || !password) return null;
  const list = await listCredentials();
  const match = list.find((c) => c.username.toLowerCase() === lower || c.email.toLowerCase() === lower);
  if (!match) {
    // Sin credencial encontrada, igual corremos un hash dummy: si solo las
    // identidades que existen tardan en responder, eso ya filtra qué
    // usuarios son válidos por temporización.
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
  return (await listCredentials()).length > 0;
}
