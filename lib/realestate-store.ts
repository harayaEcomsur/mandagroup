import { randomUUID } from "crypto";
import { db, ensureSchema, hasDb, jsonb, withDb } from "@/lib/db";

// Almacén del módulo Plan Inmobiliaria (panel multi-corredor): corredores,
// clientes, propiedades, directorio de proveedores de confianza, informes de
// entrega/recepción y contratos. Mismo patrón que lib/booking-store.ts: con
// DATABASE_URL vive en Postgres (compartido entre isolates), sin ella funciona
// en memoria para que una demo arranque sin configurar nada.

export interface Broker {
  id: string;
  email: string;
  name: string;
  role: "admin" | "corredor";
  active: boolean;
  createdAt: string;
}

export interface REClient {
  id: string;
  brokerId: string;
  name: string;
  phone?: string;
  email?: string;
  tipo: "comprador" | "arrendatario" | "arrendador" | "vendedor";
  notas?: string;
  createdAt: string;
}

// Tipo de propiedad: mismos 3 grupos que usa MercadoLibre/Portal Inmobiliario
// para el mínimo de fotos exigido (ver PROPERTY_TYPE_PHOTO_GROUP más abajo) —
// alinearlo ahora evita re-mapear todo el catálogo el día que se conecte la
// publicación automática.
export type PropertyType =
  | "casa"
  | "departamento"
  | "oficina"
  | "parcela"
  | "local_comercial"
  | "terreno"
  | "sitio"
  | "bodega"
  | "loteo"
  | "estacionamiento";

export interface REProperty {
  id: string;
  brokerId: string;
  title: string;
  operation: "venta" | "arriendo" | "arriendo_temporada";
  type: PropertyType;
  address?: string;
  // Ubicación estructurada — Portal Inmobiliario exige al menos ciudad o
  // barrio (comuna) para publicar, una dirección de texto libre no alcanza.
  region?: string;
  city?: string;
  neighborhood?: string;
  price?: number;
  currency?: "CLP" | "UF";
  description?: string;
  // Atributos de ficha técnica que exige Portal Inmobiliario al publicar
  // (nombres acá en español; ver PROPERTY_TO_ML_ATTRIBUTES para el mapeo a
  // los IDs reales de su API: BEDROOMS, FULL_BATHROOMS, COVERED_AREA, etc.).
  bedrooms?: number;
  bathrooms?: number;
  coveredArea?: number; // m² útiles
  totalArea?: number; // m² totales (terrenos/casas)
  parkingSpots?: number;
  storageUnits?: number; // bodegas
  maintenanceFee?: number; // gasto común mensual
  petsAllowed?: boolean;
  furnished?: boolean;
  condition?: "new" | "used" | "not_specified";
  photos: string[];
  status: "activa" | "reservada" | "vendida" | "arrendada";
  createdAt: string;
}

// Grupo de fotos mínimas de Portal Inmobiliario por tipo de propiedad —
// referencia para cuando se valide el mínimo antes de publicar (grupo 1: 12
// fotos, grupo 2: 6, grupo 3: 4; ver guía de Atributos de su API, 2026-09-02).
export const PROPERTY_TYPE_PHOTO_GROUP: Record<PropertyType, 1 | 2 | 3> = {
  casa: 1,
  departamento: 1,
  oficina: 1,
  parcela: 1,
  local_comercial: 2,
  terreno: 2,
  sitio: 2,
  bodega: 2,
  loteo: 2,
  estacionamiento: 3,
};

// Mapeo de nuestros campos a los IDs de atributo reales de la API de
// MercadoLibre/Portal Inmobiliario (confirmado contra su guía "Atributos"
// para inmuebles, 2026-09-02) — referencia para cuando se conecte la
// publicación automática, no se usa todavía en el store.
export const PROPERTY_TO_ML_ATTRIBUTES: Record<string, string> = {
  bedrooms: "BEDROOMS",
  bathrooms: "FULL_BATHROOMS",
  coveredArea: "COVERED_AREA", // number_unit, m²
  totalArea: "TOTAL_AREA", // number_unit, m²
  parkingSpots: "PARKING_LOTS",
  storageUnits: "WAREHOUSES",
  maintenanceFee: "MAINTENANCE_FEE",
  petsAllowed: "IS_SUITABLE_FOR_PETS",
  furnished: "FURNISHED",
  condition: "CONDITION", // "new" | "used" | "not_specified"
};

// El precio vive en la columna TEXT de siempre (no romper datos ya cargados
// en otros clientes del panel) pero la app ahora siempre escribe un número
// ahí — esto tolera valores antiguos con formato ("$120.000.000", "120.000.000 UF")
// quitando todo lo que no sea dígito o punto decimal final.
function parseLegacyPrice(raw: unknown): number | undefined {
  if (raw === null || raw === undefined) return undefined;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : undefined;
  const digitsOnly = String(raw).replace(/[^\d]/g, "");
  if (!digitsOnly) return undefined;
  const n = Number(digitsOnly);
  return Number.isFinite(n) ? n : undefined;
}

export interface REProvider {
  id: string;
  category: string;
  name: string;
  phone?: string;
  notes?: string;
  addedBy: string;
  createdAt: string;
}

export interface ChecklistItem {
  item: string;
  estado: "bien" | "regular" | "malo" | "na";
  observacion?: string;
}

export interface REDelivery {
  id: string;
  propertyId?: string;
  tipo: "entrega" | "recepcion";
  brokerId: string;
  arrendador?: { nombre?: string; rut?: string; telefono?: string };
  arrendatario?: { nombre?: string; rut?: string; telefono?: string };
  checklist: ChecklistItem[];
  meterReadings?: { luz?: string; agua?: string; gas?: string };
  photos: string[];
  notes?: string;
  createdAt: string;
}

export interface REContractTemplate {
  id: string;
  name: string;
  operation: string;
  body: string; // texto con placeholders {{variable}}
  variables: string[];
  createdAt: string;
  updatedAt: string;
}

export interface REContract {
  id: string;
  templateId: string;
  propertyId?: string;
  brokerId: string;
  variables: Record<string, string>;
  createdAt: string;
}

// Checklist operativo estándar del rubro (estado de la propiedad, no texto
// legal) — punto de partida editable desde el panel, no un formulario fijo.
export const DEFAULT_CHECKLIST_ITEMS = [
  "Llaves entregadas (cantidad y copias)",
  "Cerraduras y chapas",
  "Pintura de muros y cielos",
  "Pisos",
  "Ventanas y vidrios",
  "Griferías y artefactos sanitarios",
  "Instalación eléctrica e interruptores",
  "Cocina / encimera / horno",
  "Calefacción / calefont",
  "Mobiliario (si aplica, arriendo amoblado)",
  "Jardín / patio / estacionamiento",
  "Aseo general",
];

interface Store {
  brokers: Broker[];
  clients: REClient[];
  properties: REProperty[];
  providers: REProvider[];
  deliveries: REDelivery[];
  contractTemplates: REContractTemplate[];
  contracts: REContract[];
  seeded: boolean;
}

const g = globalThis as unknown as { __realestateStore?: Store };

function store(): Store {
  if (!g.__realestateStore) {
    g.__realestateStore = {
      brokers: [],
      clients: [],
      properties: [],
      providers: [],
      deliveries: [],
      contractTemplates: [],
      contracts: [],
      seeded: false,
    };
  }
  return g.__realestateStore;
}

function nowIso(): string {
  return new Date().toISOString();
}

// ---------- Brokers ----------

function rowToBroker(r: Record<string, unknown>): Broker {
  return {
    id: String(r.id),
    email: String(r.email),
    name: String(r.name),
    role: r.role as Broker["role"],
    active: Boolean(r.active),
    createdAt: new Date(r.created_at as string).toISOString(),
  };
}

export async function listBrokers(): Promise<Broker[]> {
  return withDb(
    async () => {
      const sql = db();
      const rows = await sql`SELECT * FROM re_brokers ORDER BY created_at ASC`;
      return rows.map(rowToBroker);
    },
    () => [...store().brokers]
  );
}

export async function brokerByEmail(email: string): Promise<Broker | null> {
  const list = await listBrokers();
  return list.find((b) => b.email.toLowerCase() === email.toLowerCase() && b.active) ?? null;
}

export async function addBroker(data: { email: string; name: string; role: Broker["role"] }): Promise<Broker> {
  const broker: Broker = { id: randomUUID(), email: data.email, name: data.name, role: data.role, active: true, createdAt: nowIso() };
  await withDb(
    async () => {
      const sql = db();
      await sql`
        INSERT INTO re_brokers (id, email, name, role, active, created_at)
        VALUES (${broker.id}, ${broker.email}, ${broker.name}, ${broker.role}, true, ${broker.createdAt})
        ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, role = EXCLUDED.role, active = true
      `;
    },
    () => {
      const existing = store().brokers.find((b) => b.email.toLowerCase() === broker.email.toLowerCase());
      if (existing) {
        existing.name = broker.name;
        existing.role = broker.role;
        existing.active = true;
      } else {
        store().brokers.push(broker);
      }
    }
  );
  return broker;
}

// No se borra: se desactiva. Así no se pierde el historial de propiedades,
// clientes y entregas que ese corredor ya generó.
export async function setBrokerActive(id: string, active: boolean): Promise<void> {
  await withDb(
    async () => {
      const sql = db();
      await sql`UPDATE re_brokers SET active = ${active} WHERE id = ${id}`;
    },
    () => {
      const b = store().brokers.find((x) => x.id === id);
      if (b) b.active = active;
    }
  );
}

// ---------- Clients ----------

function rowToClient(r: Record<string, unknown>): REClient {
  return {
    id: String(r.id),
    brokerId: String(r.broker_id),
    name: String(r.name),
    phone: (r.phone as string) ?? undefined,
    email: (r.email as string) ?? undefined,
    tipo: r.tipo as REClient["tipo"],
    notas: (r.notas as string) ?? undefined,
    createdAt: new Date(r.created_at as string).toISOString(),
  };
}

export async function listClients(): Promise<REClient[]> {
  return withDb(
    async () => {
      const sql = db();
      const rows = await sql`SELECT * FROM re_clients ORDER BY created_at DESC`;
      return rows.map(rowToClient);
    },
    () => [...store().clients].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  );
}

export async function addClient(data: Omit<REClient, "id" | "createdAt">): Promise<REClient> {
  const c: REClient = { ...data, id: randomUUID(), createdAt: nowIso() };
  await withDb(
    async () => {
      const sql = db();
      await sql`
        INSERT INTO re_clients (id, broker_id, name, phone, email, tipo, notas, created_at)
        VALUES (${c.id}, ${c.brokerId}, ${c.name}, ${c.phone ?? null}, ${c.email ?? null}, ${c.tipo}, ${c.notas ?? null}, ${c.createdAt})
      `;
    },
    () => {
      store().clients.push(c);
    }
  );
  return c;
}

export async function deleteClient(id: string): Promise<void> {
  await withDb(
    async () => {
      const sql = db();
      await sql`DELETE FROM re_clients WHERE id = ${id}`;
    },
    () => {
      store().clients = store().clients.filter((c) => c.id !== id);
    }
  );
}

// ---------- Properties ----------

function rowToProperty(r: Record<string, unknown>): REProperty {
  return {
    id: String(r.id),
    brokerId: String(r.broker_id),
    title: String(r.title),
    operation: r.operation as REProperty["operation"],
    type: r.type as REProperty["type"],
    address: (r.address as string) ?? undefined,
    region: (r.region as string) ?? undefined,
    city: (r.city as string) ?? undefined,
    neighborhood: (r.neighborhood as string) ?? undefined,
    price: parseLegacyPrice(r.price),
    currency: (r.currency as REProperty["currency"]) ?? undefined,
    description: (r.description as string) ?? undefined,
    bedrooms: r.bedrooms === null || r.bedrooms === undefined ? undefined : Number(r.bedrooms),
    bathrooms: r.bathrooms === null || r.bathrooms === undefined ? undefined : Number(r.bathrooms),
    coveredArea: r.covered_area === null || r.covered_area === undefined ? undefined : Number(r.covered_area),
    totalArea: r.total_area === null || r.total_area === undefined ? undefined : Number(r.total_area),
    parkingSpots: r.parking_spots === null || r.parking_spots === undefined ? undefined : Number(r.parking_spots),
    storageUnits: r.storage_units === null || r.storage_units === undefined ? undefined : Number(r.storage_units),
    maintenanceFee: r.maintenance_fee === null || r.maintenance_fee === undefined ? undefined : Number(r.maintenance_fee),
    petsAllowed: r.pets_allowed === null || r.pets_allowed === undefined ? undefined : Boolean(r.pets_allowed),
    furnished: r.furnished === null || r.furnished === undefined ? undefined : Boolean(r.furnished),
    condition: (r.condition as REProperty["condition"]) ?? undefined,
    photos: (r.photos as string[]) ?? [],
    status: r.status as REProperty["status"],
    createdAt: new Date(r.created_at as string).toISOString(),
  };
}

export async function listProperties(): Promise<REProperty[]> {
  return withDb(
    async () => {
      const sql = db();
      const rows = await sql`SELECT * FROM re_properties ORDER BY created_at DESC`;
      return rows.map(rowToProperty);
    },
    () => [...store().properties].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  );
}

export async function addProperty(data: Omit<REProperty, "id" | "createdAt">): Promise<REProperty> {
  const p: REProperty = { ...data, id: randomUUID(), createdAt: nowIso() };
  await withDb(
    async () => {
      const sql = db();
      await sql`
        INSERT INTO re_properties (
          id, broker_id, title, operation, type, address, region, city, neighborhood, price, currency, description,
          bedrooms, bathrooms, covered_area, total_area, parking_spots, storage_units, maintenance_fee,
          pets_allowed, furnished, condition, photos, status, created_at
        )
        VALUES (
          ${p.id}, ${p.brokerId}, ${p.title}, ${p.operation}, ${p.type}, ${p.address ?? null}, ${p.region ?? null},
          ${p.city ?? null}, ${p.neighborhood ?? null}, ${p.price ?? null}, ${p.currency ?? null}, ${p.description ?? null},
          ${p.bedrooms ?? null}, ${p.bathrooms ?? null}, ${p.coveredArea ?? null}, ${p.totalArea ?? null},
          ${p.parkingSpots ?? null}, ${p.storageUnits ?? null}, ${p.maintenanceFee ?? null},
          ${p.petsAllowed ?? null}, ${p.furnished ?? null}, ${p.condition ?? null}, ${jsonb(p.photos)}, ${p.status}, ${p.createdAt}
        )
      `;
    },
    () => {
      store().properties.push(p);
    }
  );
  return p;
}

export async function updatePropertyStatus(id: string, status: REProperty["status"]): Promise<void> {
  await withDb(
    async () => {
      const sql = db();
      await sql`UPDATE re_properties SET status = ${status} WHERE id = ${id}`;
    },
    () => {
      const p = store().properties.find((x) => x.id === id);
      if (p) p.status = status;
    }
  );
}

export async function deleteProperty(id: string): Promise<void> {
  await withDb(
    async () => {
      const sql = db();
      await sql`DELETE FROM re_properties WHERE id = ${id}`;
    },
    () => {
      store().properties = store().properties.filter((p) => p.id !== id);
    }
  );
}

// ---------- Providers (directorio de confianza) ----------

function rowToProvider(r: Record<string, unknown>): REProvider {
  return {
    id: String(r.id),
    category: String(r.category),
    name: String(r.name),
    phone: (r.phone as string) ?? undefined,
    notes: (r.notes as string) ?? undefined,
    addedBy: String(r.added_by ?? ""),
    createdAt: new Date(r.created_at as string).toISOString(),
  };
}

export async function listProviders(): Promise<REProvider[]> {
  return withDb(
    async () => {
      const sql = db();
      const rows = await sql`SELECT * FROM re_providers ORDER BY category ASC, name ASC`;
      return rows.map(rowToProvider);
    },
    () => [...store().providers].sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name))
  );
}

export async function addProvider(data: Omit<REProvider, "id" | "createdAt">): Promise<REProvider> {
  const p: REProvider = { ...data, id: randomUUID(), createdAt: nowIso() };
  await withDb(
    async () => {
      const sql = db();
      await sql`
        INSERT INTO re_providers (id, category, name, phone, notes, added_by, created_at)
        VALUES (${p.id}, ${p.category}, ${p.name}, ${p.phone ?? null}, ${p.notes ?? null}, ${p.addedBy}, ${p.createdAt})
      `;
    },
    () => {
      store().providers.push(p);
    }
  );
  return p;
}

export async function deleteProvider(id: string): Promise<void> {
  await withDb(
    async () => {
      const sql = db();
      await sql`DELETE FROM re_providers WHERE id = ${id}`;
    },
    () => {
      store().providers = store().providers.filter((p) => p.id !== id);
    }
  );
}

// ---------- Deliveries (informe de entrega/recepción) ----------

function rowToDelivery(r: Record<string, unknown>): REDelivery {
  return {
    id: String(r.id),
    propertyId: (r.property_id as string) ?? undefined,
    tipo: r.tipo as REDelivery["tipo"],
    brokerId: String(r.broker_id),
    arrendador: (r.arrendador as REDelivery["arrendador"]) ?? undefined,
    arrendatario: (r.arrendatario as REDelivery["arrendatario"]) ?? undefined,
    checklist: (r.checklist as ChecklistItem[]) ?? [],
    meterReadings: (r.meter_readings as REDelivery["meterReadings"]) ?? undefined,
    photos: (r.photos as string[]) ?? [],
    notes: (r.notes as string) ?? undefined,
    createdAt: new Date(r.created_at as string).toISOString(),
  };
}

export async function listDeliveries(): Promise<REDelivery[]> {
  return withDb(
    async () => {
      const sql = db();
      const rows = await sql`SELECT * FROM re_deliveries ORDER BY created_at DESC`;
      return rows.map(rowToDelivery);
    },
    () => [...store().deliveries].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  );
}

export async function getDelivery(id: string): Promise<REDelivery | null> {
  return withDb(
    async () => {
      const sql = db();
      const rows = await sql`SELECT * FROM re_deliveries WHERE id = ${id} LIMIT 1`;
      return rows[0] ? rowToDelivery(rows[0]) : null;
    },
    () => store().deliveries.find((d) => d.id === id) ?? null
  );
}

export async function addDelivery(data: Omit<REDelivery, "id" | "createdAt">): Promise<REDelivery> {
  const d: REDelivery = { ...data, id: randomUUID(), createdAt: nowIso() };
  await withDb(
    async () => {
      const sql = db();
      await sql`
        INSERT INTO re_deliveries
          (id, property_id, tipo, broker_id, arrendador, arrendatario, checklist, meter_readings, photos, notes, created_at)
        VALUES (${d.id}, ${d.propertyId ?? null}, ${d.tipo}, ${d.brokerId}, ${jsonb(d.arrendador ?? null)},
                ${jsonb(d.arrendatario ?? null)}, ${jsonb(d.checklist)}, ${jsonb(d.meterReadings ?? null)},
                ${jsonb(d.photos)}, ${d.notes ?? null}, ${d.createdAt})
      `;
    },
    () => {
      store().deliveries.push(d);
    }
  );
  return d;
}

// ---------- Contract templates & instances ----------

function rowToTemplate(r: Record<string, unknown>): REContractTemplate {
  return {
    id: String(r.id),
    name: String(r.name),
    operation: String(r.operation),
    body: String(r.body),
    variables: (r.variables as string[]) ?? [],
    createdAt: new Date(r.created_at as string).toISOString(),
    updatedAt: new Date((r.updated_at as string) ?? (r.created_at as string)).toISOString(),
  };
}

export async function listContractTemplates(): Promise<REContractTemplate[]> {
  return withDb(
    async () => {
      const sql = db();
      const rows = await sql`SELECT * FROM re_contract_templates ORDER BY name ASC`;
      return rows.map(rowToTemplate);
    },
    () => [...store().contractTemplates].sort((a, b) => a.name.localeCompare(b.name))
  );
}

// Detecta {{variable}} en el cuerpo de la plantilla — no hace falta declararlas
// a mano, se derivan del texto que Rossana pega.
export function extractVariables(body: string): string[] {
  const found = new Set<string>();
  for (const m of body.matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g)) found.add(m[1]);
  return [...found];
}

export async function saveContractTemplate(data: {
  id?: string;
  name: string;
  operation: string;
  body: string;
}): Promise<REContractTemplate> {
  const variables = extractVariables(data.body);
  const now = nowIso();
  const t: REContractTemplate = {
    id: data.id ?? randomUUID(),
    name: data.name,
    operation: data.operation,
    body: data.body,
    variables,
    createdAt: now,
    updatedAt: now,
  };
  await withDb(
    async () => {
      const sql = db();
      await sql`
        INSERT INTO re_contract_templates (id, name, operation, body, variables, created_at, updated_at)
        VALUES (${t.id}, ${t.name}, ${t.operation}, ${t.body}, ${jsonb(t.variables)}, ${t.createdAt}, ${t.updatedAt})
        ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, operation = EXCLUDED.operation,
          body = EXCLUDED.body, variables = EXCLUDED.variables, updated_at = EXCLUDED.updated_at
      `;
    },
    () => {
      const idx = store().contractTemplates.findIndex((x) => x.id === t.id);
      if (idx >= 0) {
        t.createdAt = store().contractTemplates[idx].createdAt;
        store().contractTemplates[idx] = t;
      } else {
        store().contractTemplates.push(t);
      }
    }
  );
  return t;
}

export async function deleteContractTemplate(id: string): Promise<void> {
  await withDb(
    async () => {
      const sql = db();
      await sql`DELETE FROM re_contract_templates WHERE id = ${id}`;
    },
    () => {
      store().contractTemplates = store().contractTemplates.filter((t) => t.id !== id);
    }
  );
}

export function renderContract(template: REContractTemplate, variables: Record<string, string>): string {
  return template.body.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => variables[key] ?? `[${key}]`);
}

export async function addContract(data: Omit<REContract, "id" | "createdAt">): Promise<REContract> {
  const c: REContract = { ...data, id: randomUUID(), createdAt: nowIso() };
  await withDb(
    async () => {
      const sql = db();
      await sql`
        INSERT INTO re_contracts (id, template_id, property_id, broker_id, variables, created_at)
        VALUES (${c.id}, ${c.templateId}, ${c.propertyId ?? null}, ${c.brokerId}, ${jsonb(c.variables)}, ${c.createdAt})
      `;
    },
    () => {
      store().contracts.push(c);
    }
  );
  return c;
}

export async function listContracts(): Promise<REContract[]> {
  return withDb(
    async () => {
      const sql = db();
      const rows = await sql`SELECT * FROM re_contracts ORDER BY created_at DESC`;
      return rows.map((r) => ({
        id: String(r.id),
        templateId: String(r.template_id),
        propertyId: (r.property_id as string) ?? undefined,
        brokerId: String(r.broker_id),
        variables: (r.variables as Record<string, string>) ?? {},
        createdAt: new Date(r.created_at as string).toISOString(),
      }));
    },
    () => [...store().contracts].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  );
}

// Para que el globalThis-store en memoria no reviente si ensureSchema nunca se
// llamó (sin DATABASE_URL, hasDb() ya corta antes en withDb) — no requiere nada
// especial, pero se deja explícito por si algún caller quiere forzar el chequeo.
export async function ensureRealestateSchema(): Promise<void> {
  if (hasDb()) await ensureSchema();
}
