import { z } from "zod";
import { clientConfig } from "@/config/client.config";
import { currentBroker } from "@/lib/realestate-auth";
import {
  listBrokers,
  addBroker,
  setBrokerActive,
  listClients,
  addClient,
  deleteClient,
  listProperties,
  addProperty,
  updatePropertyStatus,
  deleteProperty,
  listProviders,
  addProvider,
  deleteProvider,
  listDeliveries,
  addDelivery,
  listContractTemplates,
  saveContractTemplate,
  deleteContractTemplate,
  listContracts,
  addContract,
  renderContract,
  DEFAULT_CHECKLIST_ITEMS,
  type Broker,
} from "@/lib/realestate-store";

// API del panel /inmobiliaria/admin. Un solo endpoint con un campo `kind` para
// no explotar en una ruta por recurso (mismo espíritu que /api/agenda). GET
// entrega todo lo que el rol puede ver de una vez; POST/PATCH/DELETE mutan
// según `kind`. Rossana (admin) ve y edita todo; cada corredora ve y edita
// solo lo suyo (clientes, propiedades, entregas, contratos que ella generó).
// El directorio de proveedores lo cura Rossana — las corredoras solo lo leen.
export const runtime = "nodejs";

function claveFromRequest(req: Request): string | null {
  return req.headers.get("x-re-key") ?? new URL(req.url).searchParams.get("clave");
}

function isAdmin(broker: Broker): boolean {
  return broker.role === "admin";
}

export async function GET(req: Request) {
  if (!clientConfig.modules.inmobiliariaAdmin) return Response.json({ error: "Panel inmobiliario no habilitado" }, { status: 404 });
  const broker = await currentBroker(claveFromRequest(req));
  if (!broker) return Response.json({ error: "No autorizado" }, { status: 401 });

  const admin = isAdmin(broker);
  const [clients, properties, deliveries, contracts, providers] = await Promise.all([
    listClients(),
    listProperties(),
    listDeliveries(),
    listContracts(),
    listProviders(),
  ]);

  const scoped = <T extends { brokerId: string }>(list: T[]) => (admin ? list : list.filter((x) => x.brokerId === broker.id));

  return Response.json({
    broker: { id: broker.id, name: broker.name, email: broker.email, role: broker.role },
    brokers: admin ? await listBrokers() : [],
    clients: scoped(clients),
    properties: scoped(properties),
    deliveries: scoped(deliveries),
    contracts: scoped(contracts),
    providers,
    contractTemplates: await listContractTemplates(),
    defaultChecklist: DEFAULT_CHECKLIST_ITEMS,
  });
}

const brokerSchema = z.object({ kind: z.literal("broker"), email: z.string().email(), name: z.string().min(2).max(120), role: z.enum(["admin", "corredor"]) });
const clientSchema = z.object({
  kind: z.literal("client"),
  name: z.string().min(2).max(120),
  phone: z.string().max(30).optional(),
  email: z.string().email().optional().or(z.literal("")),
  tipo: z.enum(["comprador", "arrendatario", "arrendador", "vendedor"]),
  notas: z.string().max(2000).optional(),
});
const propertyTypeSchema = z.enum([
  "casa",
  "departamento",
  "oficina",
  "parcela",
  "local_comercial",
  "terreno",
  "sitio",
  "bodega",
  "loteo",
  "estacionamiento",
]);
const propertySchema = z.object({
  kind: z.literal("property"),
  title: z.string().min(2).max(160),
  operation: z.enum(["venta", "arriendo", "arriendo_temporada"]),
  type: propertyTypeSchema,
  address: z.string().max(200).optional(),
  region: z.string().max(120).optional(),
  city: z.string().max(120).optional(),
  neighborhood: z.string().max(120).optional(),
  price: z.number().positive().max(999_999_999_999).optional(),
  currency: z.enum(["CLP", "UF"]).optional(),
  description: z.string().max(4000).optional(),
  bedrooms: z.number().int().min(0).max(50).optional(),
  bathrooms: z.number().int().min(0).max(50).optional(),
  coveredArea: z.number().positive().max(1_000_000).optional(),
  totalArea: z.number().positive().max(1_000_000).optional(),
  parkingSpots: z.number().int().min(0).max(500).optional(),
  storageUnits: z.number().int().min(0).max(500).optional(),
  maintenanceFee: z.number().min(0).max(999_999_999).optional(),
  petsAllowed: z.boolean().optional(),
  furnished: z.boolean().optional(),
  condition: z.enum(["new", "used", "not_specified"]).optional(),
  photos: z.array(z.string().url()).max(20).default([]),
});
const providerSchema = z.object({
  kind: z.literal("provider"),
  category: z.string().min(2).max(80),
  name: z.string().min(2).max(120),
  phone: z.string().max(30).optional(),
  notes: z.string().max(500).optional(),
});
const deliverySchema = z.object({
  kind: z.literal("delivery"),
  propertyId: z.string().optional(),
  tipo: z.enum(["entrega", "recepcion"]),
  arrendador: z.object({ nombre: z.string().optional(), rut: z.string().optional(), telefono: z.string().optional() }).optional(),
  arrendatario: z.object({ nombre: z.string().optional(), rut: z.string().optional(), telefono: z.string().optional() }).optional(),
  checklist: z.array(z.object({ item: z.string(), estado: z.enum(["bien", "regular", "malo", "na"]), observacion: z.string().optional() })),
  meterReadings: z.object({ luz: z.string().optional(), agua: z.string().optional(), gas: z.string().optional() }).optional(),
  photos: z.array(z.string().url()).max(40).default([]),
  notes: z.string().max(2000).optional(),
});
const templateSchema = z.object({
  kind: z.literal("template"),
  id: z.string().optional(),
  name: z.string().min(2).max(160),
  operation: z.string().min(2).max(60),
  body: z.string().min(10).max(20000),
});
const contractSchema = z.object({
  kind: z.literal("contract"),
  templateId: z.string(),
  propertyId: z.string().optional(),
  variables: z.record(z.string()),
});

const postSchema = z.discriminatedUnion("kind", [brokerSchema, clientSchema, propertySchema, providerSchema, deliverySchema, templateSchema, contractSchema]);

export async function POST(req: Request) {
  if (!clientConfig.modules.inmobiliariaAdmin) return Response.json({ error: "Panel inmobiliario no habilitado" }, { status: 404 });
  const broker = await currentBroker(claveFromRequest(req));
  if (!broker) return Response.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Datos inválidos", detail: parsed.error.flatten() }, { status: 400 });
  const data = parsed.data;

  if (data.kind === "broker") {
    if (!isAdmin(broker)) return Response.json({ error: "Solo la administradora puede agregar corredoras" }, { status: 403 });
    return Response.json({ ok: true, broker: await addBroker({ email: data.email, name: data.name, role: data.role }) });
  }

  if (data.kind === "client") {
    const client = await addClient({
      brokerId: broker.id,
      name: data.name,
      phone: data.phone || undefined,
      email: data.email || undefined,
      tipo: data.tipo,
      notas: data.notas,
    });
    return Response.json({ ok: true, client });
  }

  if (data.kind === "property") {
    const property = await addProperty({
      brokerId: broker.id,
      title: data.title,
      operation: data.operation,
      type: data.type,
      address: data.address,
      region: data.region,
      city: data.city,
      neighborhood: data.neighborhood,
      price: data.price,
      currency: data.currency,
      description: data.description,
      bedrooms: data.bedrooms,
      bathrooms: data.bathrooms,
      coveredArea: data.coveredArea,
      totalArea: data.totalArea,
      parkingSpots: data.parkingSpots,
      storageUnits: data.storageUnits,
      maintenanceFee: data.maintenanceFee,
      petsAllowed: data.petsAllowed,
      furnished: data.furnished,
      condition: data.condition,
      photos: data.photos,
      status: "activa",
    });
    return Response.json({ ok: true, property });
  }

  if (data.kind === "provider") {
    if (!isAdmin(broker)) return Response.json({ error: "Solo la administradora cura el directorio de proveedores" }, { status: 403 });
    const provider = await addProvider({ category: data.category, name: data.name, phone: data.phone, notes: data.notes, addedBy: broker.name });
    return Response.json({ ok: true, provider });
  }

  if (data.kind === "delivery") {
    const delivery = await addDelivery({
      propertyId: data.propertyId,
      tipo: data.tipo,
      brokerId: broker.id,
      arrendador: data.arrendador,
      arrendatario: data.arrendatario,
      checklist: data.checklist,
      meterReadings: data.meterReadings,
      photos: data.photos,
      notes: data.notes,
    });
    return Response.json({ ok: true, delivery });
  }

  if (data.kind === "template") {
    if (!isAdmin(broker)) return Response.json({ error: "Solo la administradora edita las plantillas de contrato" }, { status: 403 });
    const template = await saveContractTemplate({ id: data.id, name: data.name, operation: data.operation, body: data.body });
    return Response.json({ ok: true, template });
  }

  // kind === "contract"
  const templates = await listContractTemplates();
  const template = templates.find((t) => t.id === data.templateId);
  if (!template) return Response.json({ error: "Plantilla no encontrada" }, { status: 404 });
  const contract = await addContract({ templateId: data.templateId, propertyId: data.propertyId, brokerId: broker.id, variables: data.variables });
  return Response.json({ ok: true, contract, rendered: renderContract(template, data.variables) });
}

const patchSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("broker-active"), id: z.string(), active: z.boolean() }),
  z.object({ kind: z.literal("property-status"), id: z.string(), status: z.enum(["activa", "reservada", "vendida", "arrendada"]) }),
]);

export async function PATCH(req: Request) {
  if (!clientConfig.modules.inmobiliariaAdmin) return Response.json({ error: "Panel inmobiliario no habilitado" }, { status: 404 });
  const broker = await currentBroker(claveFromRequest(req));
  if (!broker) return Response.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Datos inválidos" }, { status: 400 });
  const data = parsed.data;

  if (data.kind === "broker-active") {
    if (!isAdmin(broker)) return Response.json({ error: "Solo la administradora gestiona corredoras" }, { status: 403 });
    await setBrokerActive(data.id, data.active);
    return Response.json({ ok: true });
  }

  // property-status: la corredora dueña de la propiedad, o la admin.
  const properties = await listProperties();
  const property = properties.find((p) => p.id === data.id);
  if (!property) return Response.json({ error: "Propiedad no encontrada" }, { status: 404 });
  if (!isAdmin(broker) && property.brokerId !== broker.id) return Response.json({ error: "No autorizado" }, { status: 403 });
  await updatePropertyStatus(data.id, data.status);
  return Response.json({ ok: true });
}

const deleteSchema = z.object({ kind: z.enum(["client", "property", "provider", "template"]), id: z.string() });

export async function DELETE(req: Request) {
  if (!clientConfig.modules.inmobiliariaAdmin) return Response.json({ error: "Panel inmobiliario no habilitado" }, { status: 404 });
  const broker = await currentBroker(claveFromRequest(req));
  if (!broker) return Response.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = deleteSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Datos inválidos" }, { status: 400 });
  const { kind, id } = parsed.data;

  if (kind === "provider" || kind === "template") {
    if (!isAdmin(broker)) return Response.json({ error: "No autorizado" }, { status: 403 });
    if (kind === "provider") await deleteProvider(id);
    else await deleteContractTemplate(id);
    return Response.json({ ok: true });
  }

  if (kind === "client") {
    const clients = await listClients();
    const c = clients.find((x) => x.id === id);
    if (!c) return Response.json({ error: "No encontrado" }, { status: 404 });
    if (!isAdmin(broker) && c.brokerId !== broker.id) return Response.json({ error: "No autorizado" }, { status: 403 });
    await deleteClient(id);
    return Response.json({ ok: true });
  }

  // kind === "property"
  const properties = await listProperties();
  const p = properties.find((x) => x.id === id);
  if (!p) return Response.json({ error: "No encontrado" }, { status: 404 });
  if (!isAdmin(broker) && p.brokerId !== broker.id) return Response.json({ error: "No autorizado" }, { status: 403 });
  await deleteProperty(id);
  return Response.json({ ok: true });
}
