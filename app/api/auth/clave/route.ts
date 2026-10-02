import { z } from "zod";
import { claveUser, createSessionCookie } from "@/lib/auth";

// Intercambia la clave compartida (?clave=... heredado) por una sesión real
// (cookie httpOnly) — así el panel deja de depender de que el secreto viva
// para siempre en la URL. Mismo patrón que /api/auth/google.
export const runtime = "nodejs";

const bodySchema = z.object({ clave: z.string().min(1).max(200) });

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Falta la clave." }, { status: 400 });

  const user = claveUser(parsed.data.clave);
  if (!user) return Response.json({ error: "Clave incorrecta." }, { status: 401 });

  await createSessionCookie(user.email);
  return Response.json({ ok: true });
}
