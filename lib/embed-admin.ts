import { timingSafeEqual } from "node:crypto";

// Autenticación del panel del dueño por tenant. La clave vive SOLO en el entorno,
// namespaced por tenantId (EMBED_ADMIN_KEY_<ID>); sin ella el panel de ese tenant
// es inaccesible (default seguro). Comparación timing-safe.

export function adminKeyFor(tenantId: string): string | undefined {
  const norm = tenantId.toUpperCase().replace(/[^A-Z0-9]+/g, "_");
  return process.env[`EMBED_ADMIN_KEY_${norm}`];
}

export function adminKeyMatches(provided: string | undefined | null, tenantId: string): boolean {
  const expected = adminKeyFor(tenantId);
  if (!expected || !provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
