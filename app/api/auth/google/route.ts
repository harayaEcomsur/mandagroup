import { z } from "zod";
import { verifyGoogleCredential, createSessionCookie } from "@/lib/auth";

export const runtime = "nodejs";

const bodySchema = z.object({ credential: z.string().min(10) });

// Recibe el id_token que entrega el botón "Iniciar sesión con Google" (Google
// Identity Services) desde el navegador, lo verifica contra Google y contra la
// allowlist del cliente, y si calza deja la sesión en una cookie httpOnly.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Falta el credential de Google" }, { status: 400 });

  const result = await verifyGoogleCredential(parsed.data.credential);
  if ("error" in result) return Response.json({ error: result.error }, { status: 401 });

  await createSessionCookie(result.email);
  return Response.json({ ok: true, email: result.email, role: result.role });
}
