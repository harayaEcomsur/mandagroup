import { cookies } from "next/headers";
import { OAuth2Client } from "google-auth-library";
import { SignJWT, jwtVerify } from "jose";
import { clientConfig } from "@/config/client.config";

// Acceso a los paneles de admin (/agenda/admin, /tienda/admin). Dos métodos,
// ambos opcionales y compatibles entre sí durante la transición:
//
//  1. Google (recomendado): cada persona entra con su cuenta de Google, y se
//     autoriza contra `clientConfig.admin.users` — sin clave que compartir por
//     URL. Requiere NEXT_PUBLIC_GOOGLE_CLIENT_ID + SESSION_SECRET.
//  2. Clave compartida (heredado): ?clave=... contra AGENDA_ADMIN_KEY. Sigue
//     funcionando mientras esa env var exista, para no romper clientes que
//     todavía no migraron. Siempre actúa como "admin" — la clave es del dueño,
//     no identifica a una persona.
//
// La sesión de Google es un JWT propio (no el id_token de Google, que vive
// fuera de nuestro control) en una cookie httpOnly — funciona igual con o sin
// Postgres, porque no depende de estado compartido entre invocaciones.
//
// Roles: "admin" ve y edita todo (reservas + configuración del negocio).
// "staff" (ej. cada barbero/peluquera) solo confirma/cancela reservas y
// bloquea horarios — nunca toca configuración ni /tienda/admin. El rol se
// resuelve contra el config en CADA request (no viaja en el JWT), así que
// cambiar el rol de alguien en client.config.ts aplica de inmediato sin que
// esa persona tenga que volver a iniciar sesión.

export interface SessionUser {
  email: string;
  role: "admin" | "staff";
}

const SESSION_COOKIE = "haraya_admin_session";
const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 7; // 7 días
const CLAVE_COMPARTIDA_EMAIL = "clave-compartida";

function sessionSecret(): Uint8Array | null {
  const secret = process.env.SESSION_SECRET;
  if (!secret) return null;
  return new TextEncoder().encode(secret);
}

function findUser(email: string): SessionUser | null {
  const users = clientConfig.admin?.users ?? [];
  const match = users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  return match ? { email: match.email, role: match.role } : null;
}

// Verifica el id_token que entrega Google Identity Services en el navegador.
// Devuelve el usuario solo si la firma es válida Y el correo está en
// `admin.users` — un Google válido de un correo cualquiera no basta.
export async function verifyGoogleCredential(idToken: string): Promise<SessionUser | { error: string }> {
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
  const user = findUser(email);
  if (!user) return { error: `${email} no está autorizado para administrar este sitio.` };
  return user;
}

export async function createSessionCookie(email: string): Promise<void> {
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

export function clearSessionCookie(): void {
  cookies().delete(SESSION_COOKIE);
}

async function sessionUserFromCookie(): Promise<SessionUser | null> {
  const secret = sessionSecret();
  if (!secret) return null;
  const jwt = cookies().get(SESSION_COOKIE)?.value;
  if (!jwt) return null;
  try {
    const { payload } = await jwtVerify(jwt, secret);
    const email = typeof payload.email === "string" ? payload.email : null;
    if (!email) return null;
    // La identidad de la clave compartida no vive en admin.users — una cookie
    // emitida para ella (ver /api/auth/clave) sigue siendo válida mientras
    // AGENDA_ADMIN_KEY exista; si el dueño la rota/borra, la sesión cae sola.
    if (email === CLAVE_COMPARTIDA_EMAIL) {
      return process.env.AGENDA_ADMIN_KEY ? { email: CLAVE_COMPARTIDA_EMAIL, role: "admin" } : null;
    }
    return findUser(email);
  } catch {
    return null;
  }
}

export function claveUser(claveCandidate: string | null | undefined): SessionUser | null {
  const key = process.env.AGENDA_ADMIN_KEY;
  return key && claveCandidate === key ? { email: CLAVE_COMPARTIDA_EMAIL, role: "admin" } : null;
}

// Para decidir si mostrar tarjetas ligadas a la clave compartida (ej. el feed
// ICS de calendario) — cierto tanto si la sesión llegó por el form de login
// nuevo (cookie) como por el ?clave= heredado en la URL.
export function isClaveSession(user: SessionUser | null): boolean {
  return user?.email === CLAVE_COMPARTIDA_EMAIL;
}

// Cualquier persona autorizada — admin o staff — para /agenda/admin: ambos
// gestionan reservas y bloqueos, ver route.ts para qué le vetamos al staff.
export async function currentAgendaUser(claveCandidate?: string | null): Promise<SessionUser | null> {
  return (await sessionUserFromCookie()) ?? claveUser(claveCandidate);
}

// Solo admin — para /tienda/admin y cualquier acción de configuración del
// negocio dentro de la agenda (avisos, precios, tope diario, anticipación).
export async function currentAdminUser(claveCandidate?: string | null): Promise<SessionUser | null> {
  const user = await currentAgendaUser(claveCandidate);
  return user?.role === "admin" ? user : null;
}

export function googleLoginEnabled(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID && process.env.SESSION_SECRET && clientConfig.admin?.users?.length
  );
}

export function claveLoginEnabled(): boolean {
  return Boolean(process.env.AGENDA_ADMIN_KEY);
}
