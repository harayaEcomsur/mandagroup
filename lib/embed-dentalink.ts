import type { EmbedTenant } from "@/config/embed-tenants";

// Conector real a la API de Dentalink (api.dentalink.healthatom.com) para
// tenants del asistente embebible cuya agenda vive ahí, en vez de nuestra
// agenda propia (lib/embed-agenda.ts). Construido contra la documentación
// oficial (api.dentalink.healthatom.com/docs) revisada el 2026-08-31.
//
// OJO: no hay ninguna cuenta real de Dentalink con la API activada todavía
// (el cliente tiene que pagarle a Dentalink por ese add-on y generar su
// token) — este conector está hecho contra el contrato documentado, pero
// SIN probarse en vivo contra una cuenta real. Verificar con la primera
// cuenta real (ej. Boutique Dental Montemar, si contratan la API) antes de
// confiar en él con un cliente pagando.
//
// Aislamiento de credenciales: mismo patrón que embed-webpay.ts — el token
// vive SOLO en la env var namespaced por tenant, nunca en config/embed-tenants.ts:
//   DENTALINK_TOKEN_<ID>
// donde <ID> es el tenantId en MAYÚSCULAS con lo no alfanumérico como "_".
// Sin esa env var, las tools de Dentalink simplemente no se activan.

const BASE_URL = "https://api.dentalink.healthatom.com/api/v1";

function envKey(tenantId: string): string {
  const norm = tenantId.toUpperCase().replace(/[^A-Z0-9]+/g, "_");
  return `DENTALINK_TOKEN_${norm}`;
}

export function dentalinkTokenFor(tenant: EmbedTenant): string | null {
  return process.env[envKey(tenant.id)] ?? null;
}

async function dlFetch<T>(path: string, token: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Token ${token}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
  if (!res.ok) {
    throw new Error(`Dentalink ${init.method ?? "GET"} ${path} falló (${res.status}): ${await res.text().catch(() => "")}`);
  }
  return (await res.json()) as T;
}

export interface DentalinkSlot {
  id_paciente: number; // 0 = libre
  nombre_paciente: string;
  hora_inicio: string; // "HH:MM"
  hora_fin: string;
  duracion: number;
  id_dentista: number;
  nombre_dentista: string;
  fecha: string; // "DD/MM/AAAA", tal como lo devuelve /agendas
  id_recurso: number; // == id_sillon al momento de crear la cita
}

// Horas libres para un día. duracionMin viene del tenant (config/embed-tenants.ts),
// nunca del modelo — evita que el asistente "invente" una duración rara.
export async function listarDisponibilidad(
  tenant: EmbedTenant,
  token: string,
  fechaISO: string // "AAAA-MM-DD"
): Promise<DentalinkSlot[]> {
  const cfg = tenant.externalAgenda;
  if (cfg?.provider !== "dentalink") throw new Error(`Tenant "${tenant.id}" sin externalAgenda de Dentalink configurado.`);
  const qs = new URLSearchParams({
    id_sucursal: String(cfg.idSucursal),
    fecha: fechaISO,
    duracion: String(cfg.duracionMin),
    ...(cfg.idDentista ? { id_dentista: String(cfg.idDentista) } : {}),
  });
  const { data } = await dlFetch<{ data: DentalinkSlot[] }>(`/agendas?${qs.toString()}`, token);
  return data.filter((s) => s.id_paciente === 0);
}

export interface DentalinkPaciente {
  id: number;
  nombre: string;
  apellidos: string;
  celular?: string;
  telefono?: string;
  email?: string;
}

// Nombre completo -> {nombre, apellidos}: Dentalink exige ambos por separado.
// Heurística simple (primer espacio parte nombre/apellido) — no hay forma de
// hacerlo perfecto sin pedirle el apellido aparte al paciente en el chat.
function splitNombre(nombreCompleto: string): { nombre: string; apellidos: string } {
  const partes = nombreCompleto.trim().split(/\s+/);
  if (partes.length === 1) return { nombre: partes[0], apellidos: "-" };
  return { nombre: partes[0], apellidos: partes.slice(1).join(" ") };
}

// Busca un paciente existente por celular; si no existe, lo crea. Evita
// duplicar pacientes cuando la misma persona agenda más de una vez.
export async function buscarOCrearPaciente(
  token: string,
  datos: { nombreCompleto: string; telefono: string; email?: string }
): Promise<DentalinkPaciente> {
  const celular = datos.telefono.replace(/\D/g, "");
  const q = encodeURIComponent(JSON.stringify({ celular: { eq: celular } }));
  const encontrados = await dlFetch<{ data: DentalinkPaciente[] }>(`/pacientes?q=${q}`, token);
  if (encontrados.data.length > 0) return encontrados.data[0];

  const { nombre, apellidos } = splitNombre(datos.nombreCompleto);
  const { data } = await dlFetch<{ data: DentalinkPaciente }>(`/pacientes`, token, {
    method: "POST",
    body: JSON.stringify({ nombre, apellidos, celular, email: datos.email }),
  });
  return data;
}

export interface DentalinkCita {
  id: number;
  id_paciente: number;
  id_dentista: number;
  nombre_dentista: string;
  id_sucursal: number;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  duracion: number;
  estado_cita: string;
}

export async function crearCita(
  tenant: EmbedTenant,
  token: string,
  datos: { idPaciente: number; idDentista: number; idSillon: number; fecha: string; horaInicio: string; comentario?: string }
): Promise<DentalinkCita> {
  const cfg = tenant.externalAgenda;
  if (cfg?.provider !== "dentalink") throw new Error(`Tenant "${tenant.id}" sin externalAgenda de Dentalink configurado.`);
  const { data } = await dlFetch<{ data: DentalinkCita }>(`/citas/`, token, {
    method: "POST",
    body: JSON.stringify({
      id_dentista: datos.idDentista,
      id_especialidad: cfg.idEspecialidad,
      id_sucursal: cfg.idSucursal,
      id_sillon: datos.idSillon,
      id_paciente: datos.idPaciente,
      fecha: datos.fecha,
      hora_inicio: datos.horaInicio,
      duracion: cfg.duracionMin,
      comentario: datos.comentario,
    }),
  });
  return data;
}
