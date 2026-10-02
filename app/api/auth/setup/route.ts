import { z } from "zod";
import { createSessionCookie } from "@/lib/auth";
import { completeSetup } from "@/lib/admin-users-store";

// Primera contraseña de una cuenta invitada (ver lib/admin-users-store.ts →
// inviteAdmin): la persona la escribe acá, directo al servidor — nunca pasa
// por quien la invitó. El token es de un solo uso y expira solo (48h).
// La fuerza de la contraseña (largo, mayúsculas, minúsculas, números) se
// valida en el store (passwordPolicyError), no acá — así queda forzada sin
// importar qué camino cree la contraseña, no solo este formulario.
export const runtime = "nodejs";

const bodySchema = z.object({
  token: z.string().min(10),
  password: z.string().min(1).max(200),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Datos inválidos." }, { status: 400 });

  const result = await completeSetup(parsed.data.token, parsed.data.password);
  if (!result.ok) return Response.json({ error: result.error }, { status: 400 });

  await createSessionCookie(result.user.email);
  return Response.json({ ok: true, email: result.user.email, role: result.user.role });
}
