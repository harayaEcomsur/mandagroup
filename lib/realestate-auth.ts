import { cookies } from "next/headers";
import { OAuth2Client } from "google-auth-library";
import { SignJWT, jwtVerify } from "jose";
import { brokerByEmail, type Broker } from "@/lib/realestate-store";

// Acceso al panel /inmobiliaria/admin. Mismo esquema de dos métodos que
// lib/auth.ts (Agenda), pero la allowlist NO es config estática: vive en
// re_brokers (Rossana agrega/quita corredoras desde el propio panel, sin
// redesplegar). Cookie separada de la de Agenda por si un cliente algún día
// usa ambos módulos en el mismo sitio.
//
//  1. Google (recomendado): cada corredora entra con su cuenta, autorizada
//     contra re_brokers.email.
//  2. Clave compartida (bootstrap): ?clave=... contra REALESTATE_ADMIN_KEY,
//     siempre admin — es la forma en que Rossana entra la primera vez, antes
//     de que exista ningún corredor en la base, para poder agregarse a ella
//     misma y a las demás desde el panel.

const SESSION_COOKIE = "haraya_re_session";
const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 7;
const CLAVE_COMPARTIDA_EMAIL = "clave-compartida";

function sessionSecret(): Uint8Array | null {
  const secret = process.env.SESSION_SECRET;
  if (!secret) return null;
  return new TextEncoder().encode(secret);
}

export async function verifyGoogleCredentialRE(idToken: string): Promise<Broker | { error: string }> {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  if (!clientId) return { error: "Login con Google no está configurado en este sitio." };

  const client = new OAuth2Client(clientId);
  let payload;
  try {
    const ticket = await client.verifyIdToken({ idToken, audience: clientId });
    payload = ticket.getPayload();
  } catch {
    return { error: "Token de Google inválido o expirado." };
  }
  const email = payload?.email;
  if (!email || !payload?.email_verified) return { error: "No se pudo verificar el correo de Google." };
  const broker = await brokerByEmail(email);
  if (!broker) return { error: `${email} no está autorizado en el panel inmobiliario — pídele a Rossana que te agregue como corredora.` };
  return broker;
}

export async function createSessionCookieRE(email: string): Promise<void> {
  const secret = sessionSecret();
  if (!secret) throw new Error("Falta SESSION_SECRET");
  const jwt = await new SignJWT({ email })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
    .sign(secret);

  cookies().set(SESSION_COOKIE, jwt, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DURATION_SECONDS,
  });
}

export function clearSessionCookieRE(): void {
  cookies().delete(SESSION_COOKIE);
}

async function sessionBrokerFromCookie(): Promise<Broker | null> {
  const secret = sessionSecret();
  if (!secret) return null;
  const jwt = cookies().get(SESSION_COOKIE)?.value;
  if (!jwt) return null;
  try {
    const { payload } = await jwtVerify(jwt, secret);
    const email = typeof payload.email === "string" ? payload.email : null;
    return email ? await brokerByEmail(email) : null;
  } catch {
    return null;
  }
}

function claveBroker(claveCandidate: string | null | undefined): Broker | null {
  const key = process.env.REALESTATE_ADMIN_KEY;
  if (!key || claveCandidate !== key) return null;
  return {
    id: "_clave",
    email: CLAVE_COMPARTIDA_EMAIL,
    name: "Administradora",
    role: "admin",
    active: true,
    createdAt: new Date().toISOString(),
  };
}

export async function currentBroker(claveCandidate?: string | null): Promise<Broker | null> {
  return (await sessionBrokerFromCookie()) ?? claveBroker(claveCandidate);
}

export async function currentAdminBroker(claveCandidate?: string | null): Promise<Broker | null> {
  const broker = await currentBroker(claveCandidate);
  return broker?.role === "admin" ? broker : null;
}

export function googleLoginEnabledRE(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID && process.env.SESSION_SECRET);
}

export function claveLoginEnabledRE(): boolean {
  return Boolean(process.env.REALESTATE_ADMIN_KEY);
}
