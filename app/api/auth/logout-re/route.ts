import { clearSessionCookieRE } from "@/lib/realestate-auth";

export const runtime = "nodejs";

export async function POST() {
  clearSessionCookieRE();
  return Response.json({ ok: true });
}
