import { z } from "zod";
import { createSessionCookie } from "@/lib/auth";
import { verifyAdminCredential } from "@/lib/admin-users-store";

// Intercambia usuario/contraseña (usuario O correo, indistinto) por una
// sesión real (cookie httpOnly) — mismo patrón que /api/auth/google y
// /api/auth/clave. La contraseña se compara con bcrypt contra el hash
// guardado (lib/admin-users-store.ts), nunca en texto plano.
export const runtime = "nodejs";

const bodySchema = z.object({
  identifier: z.string().min(1).max(200),
  password: z.string().min(1).max(200),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Faltan datos." }, { status: 400 });

  const user = await verifyAdminCredential(parsed.data.identifier, parsed.data.password);
  // Mensaje genérico a propósito: no revela si falló el usuario o la
  // contraseña, para no ayudar a adivinar cuentas válidas.
  if (!user) return Response.json({ error: "Usuario/correo o contraseña incorrectos." }, { status: 401 });

  await createSessionCookie(user.email);
  return Response.json({ ok: true, email: user.email, role: user.role });
}
