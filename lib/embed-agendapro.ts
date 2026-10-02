import type { EmbedTenant } from "@/config/embed-tenants";

// Conector real a la API de AgendaPro (developers.agendapro.com, Connect v3)
// para tenants del asistente embebible cuya agenda vive ahí. Construido
// leyendo su documentación oficial (mucho más prolija que Dentalink: páginas
// .md dedicadas por endpoint) el 2026-08-31.
//
// A diferencia de Dentalink, AgendaPro SÍ tiene autoservicio real: el negocio
// genera su propia API key desde Configuraciones > Integraciones en su cuenta,
// sin depender de que un tercero se la active. Igual no hay ninguna cuenta
// real conectada todavía — este conector está hecho contra el contrato
// documentado, sin probarse en vivo. Verificar con la primera cuenta real
// antes de confiar en él con un cliente pagando.
//
// Aislamiento de credenciales: mismo patrón que embed-dentalink.ts/embed-webpay.ts:
//   AGENDAPRO_TOKEN_<ID>
// El key debe tener los scopes bookings:read, bookings:write y clients:write
// (AgendaPro los pide al generar la key) — sin ellos, las llamadas fallan con 403.

const BASE_URL = "https://connect.agendapro.com";

function envKey(tenantId: string): string {
  const norm = tenantId.toUpperCase().replace(/[^A-Z0-9]+/g, "_");
  return `AGENDAPRO_TOKEN_${norm}`;
}

export function agendaProTokenFor(tenant: EmbedTenant): string | null {
  return process.env[envKey(tenant.id)] ?? null;
}

async function apFetch<T>(path: string, token: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
  if (!res.ok) {
    throw new Error(`AgendaPro ${init.method ?? "GET"} ${path} falló (${res.status}): ${await res.text().catch(() => "")}`);
  }
  return (await res.json()) as T;
}

export interface AgendaProSlot {
  start_time: string; // "HH:MM"
  end_time: string;
  provider_id: number;
  provider_name: string;
}

export async function listarDisponibilidad(
  tenant: EmbedTenant,
  token: string,
  fechaISO: string // "AAAA-MM-DD"
): Promise<AgendaProSlot[]> {
  const cfg = tenant.externalAgenda;
  if (cfg?.provider !== "agendapro") throw new Error(`Tenant "${tenant.id}" sin externalAgenda de AgendaPro configurado.`);
  const qs = new URLSearchParams({
    location_id: String(cfg.idLocation),
    start_date: fechaISO,
    service_id: String(cfg.idService),
    ...(cfg.idProvider ? { provider_id: String(cfg.idProvider) } : {}),
  });
  const { data } = await apFetch<{ data: { slots: AgendaProSlot[] } }>(`/v3/available_slots?${qs.toString()}`, token);
  return data.slots;
}

export interface AgendaProCliente {
  id: number;
  full_name?: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  email?: string;
}

function splitNombre(nombreCompleto: string): { first_name: string; last_name?: string } {
  const partes = nombreCompleto.trim().split(/\s+/);
  if (partes.length === 1) return { first_name: partes[0] };
  return { first_name: partes[0], last_name: partes.slice(1).join(" ") };
}

// AgendaPro exige el teléfono en formato E.164 (+56912345678). El chat suele
// capturarlo con espacios o sin "+" — se normaliza asumiendo Chile si no trae
// código de país, igual que buildWhatsAppLink en el resto del proyecto.
function toE164(phone: string): string {
  const digits = phone.replace(/[^\d]/g, "");
  return phone.trim().startsWith("+") ? `+${digits}` : `+56${digits.replace(/^0+/, "")}`;
}

// Busca un cliente existente por teléfono (quick-search); si no hay match, lo
// crea. Evita duplicar clientes cuando la misma persona reserva más de una vez.
export async function buscarOCrearCliente(
  token: string,
  datos: { nombreCompleto: string; telefono: string; email?: string }
): Promise<AgendaProCliente> {
  const telefonoE164 = toE164(datos.telefono);
  const encontrados = await apFetch<{ data: AgendaProCliente[] }>(
    `/v3/clients/quick-search?q=${encodeURIComponent(telefonoE164)}`,
    token
  );
  const match = encontrados.data.find((c) => c.phone === telefonoE164);
  if (match) return match;

  const { first_name, last_name } = splitNombre(datos.nombreCompleto);
  return apFetch<AgendaProCliente>(`/v3/clients`, token, {
    method: "POST",
    body: JSON.stringify({ first_name, last_name, phone: telefonoE164, email: datos.email }),
  });
}

// Offset real de America/Santiago para una fecha dada — Chile todavía tiene
// horario de verano (varía entre -03:00 y -04:00 según la época del año), así
// que nunca se hardcodea: se calcula con Intl para la fecha real de la cita.
function chileOffset(fechaISO: string, horaHHMM: string): string {
  const dt = new Date(`${fechaISO}T${horaHHMM}:00`);
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Santiago", timeZoneName: "shortOffset" }).formatToParts(dt);
  const tz = parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT-3";
  const match = tz.match(/GMT([+-]\d+)/);
  const hours = match ? parseInt(match[1], 10) : -3;
  return `${hours <= 0 ? "-" : "+"}${String(Math.abs(hours)).padStart(2, "0")}:00`;
}

export interface AgendaProBooking {
  id: number;
  start_time: string;
  end_time: string;
  status: { id: number; name: string };
  service_provider: { id: number; public_name: string };
  location: { id: number; name: string };
}

export async function crearReserva(
  tenant: EmbedTenant,
  token: string,
  datos: { clientId: number; providerId: number; fecha: string; horaInicio: string; comentario?: string }
): Promise<AgendaProBooking> {
  const cfg = tenant.externalAgenda;
  if (cfg?.provider !== "agendapro") throw new Error(`Tenant "${tenant.id}" sin externalAgenda de AgendaPro configurado.`);
  const offset = chileOffset(datos.fecha, datos.horaInicio);
  return apFetch<AgendaProBooking>(`/v3/bookings`, token, {
    method: "POST",
    body: JSON.stringify({
      start_time: `${datos.fecha}T${datos.horaInicio}:00${offset}`,
      service_id: cfg.idService,
      provider_id: datos.providerId,
      client_id: datos.clientId,
      location_id: cfg.idLocation,
      status_id: 1, // "Confirmed" en el ejemplo de su documentación — verificar contra la cuenta real si tienen otros estados por defecto.
      notes: datos.comentario,
    }),
  });
}
