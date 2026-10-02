import { z } from "zod";
import { verifyGoogleCredentialRE, createSessionCookieRE } from "@/lib/realestate-auth";

export const runtime = "nodejs";

const bodySchema = z.object({ credential: z.string().min(10) });

// Igual que /api/auth/google pero contra la allowlist dinámica de corredores
// (re_brokers) en vez de client.config.ts — ver lib/realestate-auth.ts.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Falta el credential de Google" }, { status: 400 });

  const result = await verifyGoogleCredentialRE(parsed.data.credential);
  if ("error" in result) return Response.json({ error: result.error }, { status: 401 });

  await createSessionCookieRE(result.email);
  return Response.json({ ok: true, email: result.email, role: result.role, name: result.name });
}
