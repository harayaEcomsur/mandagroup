import { z } from "zod";
import { createSessionCookie } from "@/lib/auth";
import { completeSetup } from "@/lib/admin-users-store";

// Primera contraseña de una cuenta invitada (ver lib/admin-users-store.ts →
// inviteAdmin): la persona la escribe acá, directo al servidor — nunca pasa
// por quien la invitó. El token es de un solo uso y expira solo (48h).
export const runtime = "nodejs";

const bodySchema = z.object({
  token: z.string().min(10),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres.").max(200),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos." }, { status: 400 });
  }

  const user = await completeSetup(parsed.data.token, parsed.data.password);
  if (!user) return Response.json({ error: "El link de configuración no es válido o ya expiró." }, { status: 401 });

  await createSessionCookie(user.email);
  return Response.json({ ok: true, email: user.email, role: user.role });
}
