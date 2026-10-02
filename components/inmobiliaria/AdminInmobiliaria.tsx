"use client";

import { useEffect, useMemo, useState } from "react";
import { PhotoUploader } from "@/components/inmobiliaria/PhotoUploader";

type Role = "admin" | "corredor";

interface Broker {
  id: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  createdAt: string;
}
interface REClient {
  id: string;
  brokerId: string;
  name: string;
  phone?: string;
  email?: string;
  tipo: "comprador" | "arrendatario" | "arrendador" | "vendedor";
  notas?: string;
  createdAt: string;
}
type PropertyType =
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

const PROPERTY_TYPE_LABELS: Record<PropertyType, string> = {
  casa: "Casa",
  departamento: "Departamento",
  oficina: "Oficina",
  parcela: "Parcela",
  local_comercial: "Local comercial",
  terreno: "Terreno",
  sitio: "Sitio",
  bodega: "Bodega",
  loteo: "Loteo",
  estacionamiento: "Estacionamiento",
};

interface REProperty {
  id: string;
  brokerId: string;
  title: string;
  operation: "venta" | "arriendo" | "arriendo_temporada";
  type: PropertyType;
  address?: string;
  region?: string;
  city?: string;
  neighborhood?: string;
  price?: number;
  currency?: "CLP" | "UF";
  description?: string;
  bedrooms?: number;
  bathrooms?: number;
  coveredArea?: number;
  totalArea?: number;
  parkingSpots?: number;
  storageUnits?: number;
  maintenanceFee?: number;
  petsAllowed?: boolean;
  furnished?: boolean;
  condition?: "new" | "used" | "not_specified";
  photos: string[];
  status: "activa" | "reservada" | "vendida" | "arrendada";
  createdAt: string;
}
interface REProvider {
  id: string;
  category: string;
  name: string;
  phone?: string;
  notes?: string;
  addedBy: string;
  createdAt: string;
}
interface ChecklistItem {
  item: string;
  estado: "bien" | "regular" | "malo" | "na";
  observacion?: string;
}
interface REDelivery {
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
interface REContractTemplate {
  id: string;
  name: string;
  operation: string;
  body: string;
  variables: string[];
}
interface REContract {
  id: string;
  templateId: string;
  propertyId?: string;
  brokerId: string;
  variables: Record<string, string>;
  createdAt: string;
}

interface Bundle {
  broker: { id: string; name: string; email: string; role: Role };
  brokers: Broker[];
  clients: REClient[];
  properties: REProperty[];
  deliveries: REDelivery[];
  contracts: REContract[];
  providers: REProvider[];
  contractTemplates: REContractTemplate[];
  defaultChecklist: string[];
}

const TABS = ["propiedades", "clientes", "proveedores", "entregas", "contratos", "corredoras"] as const;
type Tab = (typeof TABS)[number];

const card = "rounded-xl border border-foreground/15 p-4 sm:p-5";
const input = "w-full rounded-lg border border-foreground/20 bg-background px-3 py-2 text-sm";
const btnPrimary = "rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50";
const btnGhost = "rounded-lg border border-foreground/20 px-3 py-1.5 text-xs font-medium hover:bg-foreground/5";

export function AdminInmobiliaria({ adminKey }: { adminKey?: string }) {
  const [data, setData] = useState<Bundle | null>(null);
  const [tab, setTab] = useState<Tab>("propiedades");
  const [error, setError] = useState<string | null>(null);

  const authHeaders = useMemo<Record<string, string>>(() => {
    const headers: Record<string, string> = {};
    if (adminKey) headers["x-re-key"] = adminKey;
    return headers;
  }, [adminKey]);
  const pdfSuffix = adminKey ? `?clave=${encodeURIComponent(adminKey)}` : "";

  async function load() {
    const res = await fetch("/api/inmobiliaria", { headers: authHeaders });
    if (!res.ok) {
      setError("No se pudo cargar el panel.");
      return;
    }
    setData(await res.json());
    setError(null);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) return <p className="text-red-600">{error}</p>;
  if (!data) return <p className="text-foreground/60">Cargando…</p>;

  const isAdmin = data.broker.role === "admin";
  const tabs: { id: Tab; label: string }[] = [
    { id: "propiedades", label: "Propiedades" },
    { id: "clientes", label: "Clientes" },
    { id: "proveedores", label: "Proveedores" },
    { id: "entregas", label: "Entregas" },
    { id: "contratos", label: "Contratos" },
    ...(isAdmin ? [{ id: "corredoras" as Tab, label: "Corredoras" }] : []),
  ];

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-foreground/60">
        Conectado como <strong className="text-foreground">{data.broker.name}</strong> ({isAdmin ? "administradora" : "corredora"})
      </p>
      <div className="flex flex-wrap gap-2 border-b border-foreground/10 pb-3">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
              tab === t.id ? "bg-primary text-white" : "bg-foreground/5 text-foreground/70 hover:bg-foreground/10"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "propiedades" && <PropertiesTab data={data} authHeaders={authHeaders} reload={load} isAdmin={isAdmin} />}
      {tab === "clientes" && <ClientsTab data={data} authHeaders={authHeaders} reload={load} isAdmin={isAdmin} />}
      {tab === "proveedores" && <ProvidersTab data={data} authHeaders={authHeaders} reload={load} isAdmin={isAdmin} />}
      {tab === "entregas" && <DeliveriesTab data={data} authHeaders={authHeaders} reload={load} pdfSuffix={pdfSuffix} isAdmin={isAdmin} />}
      {tab === "contratos" && <ContractsTab data={data} authHeaders={authHeaders} reload={load} pdfSuffix={pdfSuffix} isAdmin={isAdmin} />}
      {tab === "corredoras" && isAdmin && <BrokersTab data={data} authHeaders={authHeaders} reload={load} />}
    </div>
  );
}

async function post(path: string, headers: Record<string, string>, body: unknown) {
  const res = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Error");
  return data;
}
async function patch(path: string, headers: Record<string, string>, body: unknown) {
  const res = await fetch(path, { method: "PATCH", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Error");
  return data;
}
async function del(path: string, headers: Record<string, string>, body: unknown) {
  const res = await fetch(path, { method: "DELETE", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Error");
  return data;
}

function brokerName(data: Bundle, id: string): string {
  if (id === data.broker.id) return data.broker.name;
  return data.brokers.find((b) => b.id === id)?.name ?? "—";
}

// ---------- Corredoras ----------

function BrokersTab({ data, authHeaders, reload }: { data: Bundle; authHeaders: Record<string, string>; reload: () => void }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>("corredor");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function add() {
    setBusy(true);
    setErr(null);
    try {
      await post("/api/inmobiliaria", authHeaders, { kind: "broker", email, name, role });
      setEmail("");
      setName("");
      setRole("corredor");
      reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className={card}>
        <h3 className="mb-3 font-semibold">Agregar corredora</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <input className={input} placeholder="Nombre" value={name} onChange={(e) => setName(e.target.value)} />
          <input className={input} placeholder="Correo de Google" value={email} onChange={(e) => setEmail(e.target.value)} />
          <select className={input} value={role} onChange={(e) => setRole(e.target.value as Role)}>
            <option value="corredor">Corredora</option>
            <option value="admin">Administradora</option>
          </select>
        </div>
        <button className={`${btnPrimary} mt-3`} disabled={busy || !email || !name} onClick={add}>
          Agregar
        </button>
        {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
        <p className="mt-2 text-xs text-foreground/50">Se autoriza a esa persona a entrar con su cuenta de Google — no se comparte ninguna clave.</p>
      </div>

      <div className={card}>
        <h3 className="mb-3 font-semibold">Corredoras</h3>
        <ul className="flex flex-col gap-2">
          {data.brokers.map((b) => (
            <li key={b.id} className="flex items-center justify-between gap-3 rounded-lg border border-foreground/10 p-3">
              <div>
                <p className="text-sm font-medium">
                  {b.name} <span className="text-foreground/50">({b.role === "admin" ? "admin" : "corredora"})</span>
                </p>
                <p className="text-xs text-foreground/50">{b.email}</p>
              </div>
              <button
                className={btnGhost}
                onClick={async () => {
                  await patch("/api/inmobiliaria", authHeaders, { kind: "broker-active", id: b.id, active: !b.active });
                  reload();
                }}
              >
                {b.active ? "Desactivar" : "Activar"}
              </button>
            </li>
          ))}
          {data.brokers.length === 0 && <p className="text-sm text-foreground/50">Todavía no hay corredoras agregadas.</p>}
        </ul>
      </div>
    </div>
  );
}

// ---------- Propiedades ----------

// Grupo de fotos mínimas de Portal Inmobiliario por tipo (1: 12 fotos —
// casas/deptos/oficinas/parcelas; 2: 6 fotos — locales/terrenos/sitios/
// bodegas/loteos; 3: 4 fotos — estacionamientos). Solo un aviso en el
// formulario, no bloquea publicar — la publicación real todavía no está
// conectada a su API.
const PROPERTY_TYPE_MIN_PHOTOS: Record<PropertyType, number> = {
  casa: 12,
  departamento: 12,
  oficina: 12,
  parcela: 12,
  local_comercial: 6,
  terreno: 6,
  sitio: 6,
  bodega: 6,
  loteo: 6,
  estacionamiento: 4,
};

function numOrUndefined(s: string): number | undefined {
  if (!s.trim()) return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

function formatPrice(p: REProperty): string {
  if (p.price === undefined) return "";
  const formatted = p.currency === "UF" ? `UF ${p.price.toLocaleString("es-CL")}` : `$${p.price.toLocaleString("es-CL")}`;
  return formatted;
}

function PropertiesTab({ data, authHeaders, reload, isAdmin }: { data: Bundle; authHeaders: Record<string, string>; reload: () => void; isAdmin: boolean }) {
  const [title, setTitle] = useState("");
  const [operation, setOperation] = useState<REProperty["operation"]>("venta");
  const [type, setType] = useState<PropertyType>("departamento");
  const [address, setAddress] = useState("");
  const [region, setRegion] = useState("");
  const [city, setCity] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState<"CLP" | "UF">("CLP");
  const [bedrooms, setBedrooms] = useState("");
  const [bathrooms, setBathrooms] = useState("");
  const [parkingSpots, setParkingSpots] = useState("");
  const [storageUnits, setStorageUnits] = useState("");
  const [coveredArea, setCoveredArea] = useState("");
  const [totalArea, setTotalArea] = useState("");
  const [maintenanceFee, setMaintenanceFee] = useState("");
  const [condition, setCondition] = useState<REProperty["condition"]>("used");
  const [furnished, setFurnished] = useState(false);
  const [petsAllowed, setPetsAllowed] = useState(true);
  const [description, setDescription] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function add() {
    setBusy(true);
    setErr(null);
    try {
      await post("/api/inmobiliaria", authHeaders, {
        kind: "property",
        title,
        operation,
        type,
        address: address || undefined,
        region: region || undefined,
        city: city || undefined,
        neighborhood: neighborhood || undefined,
        price: numOrUndefined(price),
        currency,
        bedrooms: numOrUndefined(bedrooms),
        bathrooms: numOrUndefined(bathrooms),
        parkingSpots: numOrUndefined(parkingSpots),
        storageUnits: numOrUndefined(storageUnits),
        coveredArea: numOrUndefined(coveredArea),
        totalArea: numOrUndefined(totalArea),
        maintenanceFee: numOrUndefined(maintenanceFee),
        condition,
        furnished,
        petsAllowed,
        description: description || undefined,
        photos,
      });
      setTitle("");
      setAddress("");
      setRegion("");
      setCity("");
      setNeighborhood("");
      setPrice("");
      setBedrooms("");
      setBathrooms("");
      setParkingSpots("");
      setStorageUnits("");
      setCoveredArea("");
      setTotalArea("");
      setMaintenanceFee("");
      setFurnished(false);
      setPetsAllowed(true);
      setDescription("");
      setPhotos([]);
      reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className={card}>
        <h3 className="mb-3 font-semibold">Nueva propiedad</h3>
        <p className="mb-3 text-xs text-foreground/50">
          Formato recomendado del título: Operación + Tipo + Dormitorios + Barrio (ej. &quot;Venta departamento 3 dormitorios
          Reñaca&quot;) — así queda listo si más adelante se publica en portales externos.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <input className={input} placeholder="Título" value={title} onChange={(e) => setTitle(e.target.value)} />
          <select className={input} value={operation} onChange={(e) => setOperation(e.target.value as REProperty["operation"])}>
            <option value="venta">Venta</option>
            <option value="arriendo">Arriendo</option>
            <option value="arriendo_temporada">Arriendo temporada</option>
          </select>
          <select className={input} value={type} onChange={(e) => setType(e.target.value as PropertyType)}>
            {Object.entries(PROPERTY_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <select className={input} value={condition} onChange={(e) => setCondition(e.target.value as REProperty["condition"])}>
            <option value="used">Usada</option>
            <option value="new">Nueva / a estrenar</option>
            <option value="not_specified">No especificada</option>
          </select>
        </div>

        <p className="mb-1 mt-4 text-xs font-semibold uppercase tracking-wide text-foreground/50">Ubicación</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <input className={input} placeholder="Región" value={region} onChange={(e) => setRegion(e.target.value)} />
          <input className={input} placeholder="Ciudad" value={city} onChange={(e) => setCity(e.target.value)} />
          <input className={input} placeholder="Comuna / barrio" value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} />
          <input className={input} placeholder="Dirección (calle y número)" value={address} onChange={(e) => setAddress(e.target.value)} />
        </div>

        <p className="mb-1 mt-4 text-xs font-semibold uppercase tracking-wide text-foreground/50">Precio</p>
        <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr]">
          <input className={input} placeholder="Precio" type="number" min="0" value={price} onChange={(e) => setPrice(e.target.value)} />
          <select className={input} value={currency} onChange={(e) => setCurrency(e.target.value as "CLP" | "UF")}>
            <option value="CLP">CLP</option>
            <option value="UF">UF</option>
          </select>
          <input
            className={input}
            placeholder="Gasto común"
            type="number"
            min="0"
            value={maintenanceFee}
            onChange={(e) => setMaintenanceFee(e.target.value)}
          />
        </div>

        <p className="mb-1 mt-4 text-xs font-semibold uppercase tracking-wide text-foreground/50">Ficha técnica</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <input className={input} placeholder="Dormitorios" type="number" min="0" value={bedrooms} onChange={(e) => setBedrooms(e.target.value)} />
          <input className={input} placeholder="Baños" type="number" min="0" value={bathrooms} onChange={(e) => setBathrooms(e.target.value)} />
          <input
            className={input}
            placeholder="Estacionamientos"
            type="number"
            min="0"
            value={parkingSpots}
            onChange={(e) => setParkingSpots(e.target.value)}
          />
          <input className={input} placeholder="Bodegas" type="number" min="0" value={storageUnits} onChange={(e) => setStorageUnits(e.target.value)} />
          <input
            className={input}
            placeholder="Superficie útil (m²)"
            type="number"
            min="0"
            value={coveredArea}
            onChange={(e) => setCoveredArea(e.target.value)}
          />
          <input
            className={input}
            placeholder="Superficie total (m²)"
            type="number"
            min="0"
            value={totalArea}
            onChange={(e) => setTotalArea(e.target.value)}
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={furnished} onChange={(e) => setFurnished(e.target.checked)} />
            Amoblada
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={petsAllowed} onChange={(e) => setPetsAllowed(e.target.checked)} />
            Acepta mascotas
          </label>
        </div>

        <textarea className={`${input} mt-4`} placeholder="Descripción" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
        <div className="mt-3">
          <p className="mb-1 text-xs text-foreground/50">Mínimo recomendado para este tipo: {PROPERTY_TYPE_MIN_PHOTOS[type]} fotos.</p>
          <PhotoUploader photos={photos} onChange={setPhotos} authHeaders={authHeaders} />
        </div>
        <button className={`${btnPrimary} mt-3`} disabled={busy || !title || !type} onClick={add}>
          Publicar propiedad
        </button>
        {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {data.properties.map((p) => (
          <div key={p.id} className={card}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold">{p.title}</p>
                <p className="text-xs text-foreground/50">
                  {p.operation} · {PROPERTY_TYPE_LABELS[p.type] ?? p.type}
                  {p.neighborhood ? ` · ${p.neighborhood}` : p.address ? ` · ${p.address}` : ""}
                </p>
                <p className="text-xs text-foreground/50">
                  {[
                    p.bedrooms !== undefined && `${p.bedrooms} dorm.`,
                    p.bathrooms !== undefined && `${p.bathrooms} baños`,
                    p.coveredArea !== undefined && `${p.coveredArea} m²`,
                    p.parkingSpots !== undefined && `${p.parkingSpots} estac.`,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                {p.price !== undefined && <p className="text-sm font-medium text-primary">{formatPrice(p)}</p>}
                {isAdmin && <p className="text-xs text-foreground/40">Corredora: {brokerName(data, p.brokerId)}</p>}
              </div>
              <select
                className="rounded-lg border border-foreground/20 bg-background px-2 py-1 text-xs"
                value={p.status}
                onChange={async (e) => {
                  await patch("/api/inmobiliaria", authHeaders, { kind: "property-status", id: p.id, status: e.target.value });
                  reload();
                }}
              >
                <option value="activa">Activa</option>
                <option value="reservada">Reservada</option>
                <option value="vendida">Vendida</option>
                <option value="arrendada">Arrendada</option>
              </select>
            </div>
            {p.photos.length > 0 && (
              <div className="mt-2 flex gap-2 overflow-x-auto">
                {p.photos.map((url) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={url} src={url} alt="" className="h-16 w-16 flex-shrink-0 rounded-lg object-cover" />
                ))}
              </div>
            )}
            <button
              className={`${btnGhost} mt-3`}
              onClick={async () => {
                if (!confirm("¿Eliminar esta propiedad?")) return;
                await del("/api/inmobiliaria", authHeaders, { kind: "property", id: p.id });
                reload();
              }}
            >
              Eliminar
            </button>
          </div>
        ))}
        {data.properties.length === 0 && <p className="text-sm text-foreground/50">Sin propiedades todavía.</p>}
      </div>
    </div>
  );
}

// ---------- Clientes ----------

function ClientsTab({ data, authHeaders, reload, isAdmin }: { data: Bundle; authHeaders: Record<string, string>; reload: () => void; isAdmin: boolean }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [tipo, setTipo] = useState<REClient["tipo"]>("comprador");
  const [notas, setNotas] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function add() {
    setBusy(true);
    setErr(null);
    try {
      await post("/api/inmobiliaria", authHeaders, { kind: "client", name, phone, email, tipo, notas });
      setName("");
      setPhone("");
      setEmail("");
      setNotas("");
      reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className={card}>
        <h3 className="mb-3 font-semibold">Nuevo cliente</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <input className={input} placeholder="Nombre" value={name} onChange={(e) => setName(e.target.value)} />
          <select className={input} value={tipo} onChange={(e) => setTipo(e.target.value as REClient["tipo"])}>
            <option value="comprador">Comprador/a</option>
            <option value="arrendatario">Arrendatario/a</option>
            <option value="arrendador">Arrendador/a (dueño/a)</option>
            <option value="vendedor">Vendedor/a</option>
          </select>
          <input className={input} placeholder="Teléfono" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <input className={input} placeholder="Correo" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <textarea className={`${input} mt-3`} placeholder="Notas" rows={2} value={notas} onChange={(e) => setNotas(e.target.value)} />
        <p className="mt-3 text-xs text-foreground/50">
          Antes de guardar, confirma que este cliente ya sabe cómo tratamos sus datos — ver{" "}
          <a href="/privacidad" target="_blank" rel="noopener noreferrer" className="underline hover:text-primary">
            política de privacidad
          </a>
          .
        </p>
        <button className={`${btnPrimary} mt-3`} disabled={busy || !name} onClick={add}>
          Guardar cliente
        </button>
        {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
      </div>

      <div className={card}>
        <ul className="flex flex-col gap-2">
          {data.clients.map((c) => (
            <li key={c.id} className="flex items-start justify-between gap-3 rounded-lg border border-foreground/10 p-3">
              <div>
                <p className="text-sm font-medium">
                  {c.name} <span className="text-foreground/50">({c.tipo})</span>
                </p>
                <p className="text-xs text-foreground/50">
                  {c.phone} {c.email ? `· ${c.email}` : ""}
                </p>
                {c.notas && <p className="mt-1 text-xs text-foreground/60">{c.notas}</p>}
                {isAdmin && <p className="text-xs text-foreground/40">Corredora: {brokerName(data, c.brokerId)}</p>}
              </div>
              <button
                className={btnGhost}
                onClick={async () => {
                  await del("/api/inmobiliaria", authHeaders, { kind: "client", id: c.id });
                  reload();
                }}
              >
                Eliminar
              </button>
            </li>
          ))}
          {data.clients.length === 0 && <p className="text-sm text-foreground/50">Sin clientes todavía.</p>}
        </ul>
      </div>
    </div>
  );
}

// ---------- Proveedores ----------

function ProvidersTab({ data, authHeaders, reload, isAdmin }: { data: Bundle; authHeaders: Record<string, string>; reload: () => void; isAdmin: boolean }) {
  const [category, setCategory] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function add() {
    setBusy(true);
    setErr(null);
    try {
      await post("/api/inmobiliaria", authHeaders, { kind: "provider", category, name, phone, notes });
      setCategory("");
      setName("");
      setPhone("");
      setNotes("");
      reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className={card}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold">Directorio de confianza</h3>
          <button
            className={btnGhost}
            onClick={() => {
              navigator.clipboard.writeText(`${window.location.origin}/proveedores`);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
          >
            {copied ? "¡Copiado!" : "Copiar link para dueños/arrendatarios"}
          </button>
        </div>
        <p className="mt-1 text-xs text-foreground/50">
          Esta lista se ve en <code className="rounded bg-foreground/10 px-1">/proveedores</code>, sin login — compártela por WhatsApp al entregar una propiedad.
        </p>
      </div>

      {isAdmin && (
        <div className={card}>
          <h3 className="mb-3 font-semibold">Agregar proveedor</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <input className={input} placeholder="Rubro (electricista, gasfíter...)" value={category} onChange={(e) => setCategory(e.target.value)} />
            <input className={input} placeholder="Nombre" value={name} onChange={(e) => setName(e.target.value)} />
            <input className={input} placeholder="Teléfono / WhatsApp" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <textarea className={`${input} mt-3`} placeholder="Nota (por qué confías en él/ella)" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          <button className={`${btnPrimary} mt-3`} disabled={busy || !category || !name} onClick={add}>
            Agregar al directorio
          </button>
          {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
        </div>
      )}

      <div className={card}>
        <ul className="flex flex-col gap-2">
          {data.providers.map((p) => (
            <li key={p.id} className="flex items-start justify-between gap-3 rounded-lg border border-foreground/10 p-3">
              <div>
                <p className="text-sm font-medium">
                  {p.name} <span className="text-foreground/50">— {p.category}</span>
                </p>
                <p className="text-xs text-foreground/50">{p.phone}</p>
                {p.notes && <p className="mt-1 text-xs text-foreground/60">{p.notes}</p>}
              </div>
              {isAdmin && (
                <button
                  className={btnGhost}
                  onClick={async () => {
                    await del("/api/inmobiliaria", authHeaders, { kind: "provider", id: p.id });
                    reload();
                  }}
                >
                  Eliminar
                </button>
              )}
            </li>
          ))}
          {data.providers.length === 0 && <p className="text-sm text-foreground/50">Sin proveedores todavía.</p>}
        </ul>
      </div>
    </div>
  );
}

// ---------- Entregas ----------

function DeliveriesTab({
  data,
  authHeaders,
  reload,
  pdfSuffix,
  isAdmin,
}: {
  data: Bundle;
  authHeaders: Record<string, string>;
  reload: () => void;
  pdfSuffix: string;
  isAdmin: boolean;
}) {
  const [tipo, setTipo] = useState<REDelivery["tipo"]>("entrega");
  const [propertyId, setPropertyId] = useState("");
  const [arrendadorNombre, setArrendadorNombre] = useState("");
  const [arrendatarioNombre, setArrendatarioNombre] = useState("");
  const [luz, setLuz] = useState("");
  const [agua, setAgua] = useState("");
  const [gas, setGas] = useState("");
  const [notes, setNotes] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [checklist, setChecklist] = useState<ChecklistItem[]>(() => data.defaultChecklist.map((item) => ({ item, estado: "bien" as const })));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function updateItem(idx: number, patchItem: Partial<ChecklistItem>) {
    setChecklist((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patchItem } : it)));
  }

  async function add() {
    setBusy(true);
    setErr(null);
    try {
      await post("/api/inmobiliaria", authHeaders, {
        kind: "delivery",
        propertyId: propertyId || undefined,
        tipo,
        arrendador: arrendadorNombre ? { nombre: arrendadorNombre } : undefined,
        arrendatario: arrendatarioNombre ? { nombre: arrendatarioNombre } : undefined,
        checklist,
        meterReadings: { luz, agua, gas },
        photos,
        notes,
      });
      setArrendadorNombre("");
      setArrendatarioNombre("");
      setLuz("");
      setAgua("");
      setGas("");
      setNotes("");
      setPhotos([]);
      setChecklist(data.defaultChecklist.map((item) => ({ item, estado: "bien" as const })));
      reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  const estadoLabel: Record<ChecklistItem["estado"], string> = { bien: "Bien", regular: "Regular", malo: "Malo", na: "N/A" };

  return (
    <div className="flex flex-col gap-4">
      <div className={card}>
        <h3 className="mb-3 font-semibold">Nuevo informe</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <select className={input} value={tipo} onChange={(e) => setTipo(e.target.value as REDelivery["tipo"])}>
            <option value="entrega">Entrega (al arrendatario/comprador)</option>
            <option value="recepcion">Recepción (de vuelta al dueño)</option>
          </select>
          <select className={input} value={propertyId} onChange={(e) => setPropertyId(e.target.value)}>
            <option value="">Sin propiedad asociada</option>
            {data.properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
          <input className={input} placeholder="Nombre del arrendador/a o dueño/a" value={arrendadorNombre} onChange={(e) => setArrendadorNombre(e.target.value)} />
          <input className={input} placeholder="Nombre del arrendatario/a o comprador/a" value={arrendatarioNombre} onChange={(e) => setArrendatarioNombre(e.target.value)} />
        </div>

        <p className="mb-2 mt-4 text-sm font-medium">Lecturas de medidores</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <input className={input} placeholder="Luz" value={luz} onChange={(e) => setLuz(e.target.value)} />
          <input className={input} placeholder="Agua" value={agua} onChange={(e) => setAgua(e.target.value)} />
          <input className={input} placeholder="Gas" value={gas} onChange={(e) => setGas(e.target.value)} />
        </div>

        <p className="mb-2 mt-4 text-sm font-medium">Checklist de estado</p>
        <div className="flex flex-col gap-2">
          {checklist.map((it, idx) => (
            <div key={it.item} className="flex flex-wrap items-center gap-2 rounded-lg border border-foreground/10 p-2">
              <span className="flex-1 text-sm">{it.item}</span>
              <select className="rounded-lg border border-foreground/20 bg-background px-2 py-1 text-xs" value={it.estado} onChange={(e) => updateItem(idx, { estado: e.target.value as ChecklistItem["estado"] })}>
                {Object.entries(estadoLabel).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
              <input
                className="min-w-[140px] flex-1 rounded-lg border border-foreground/20 bg-background px-2 py-1 text-xs"
                placeholder="Observación (opcional)"
                value={it.observacion ?? ""}
                onChange={(e) => updateItem(idx, { observacion: e.target.value })}
              />
            </div>
          ))}
        </div>

        <p className="mb-2 mt-4 text-sm font-medium">Fotografías</p>
        <PhotoUploader photos={photos} onChange={setPhotos} authHeaders={authHeaders} max={40} />

        <textarea className={`${input} mt-4`} placeholder="Observaciones generales" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />

        <button className={`${btnPrimary} mt-4`} disabled={busy} onClick={add}>
          Guardar informe
        </button>
        {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
      </div>

      <div className={card}>
        <h3 className="mb-3 font-semibold">Informes generados</h3>
        <ul className="flex flex-col gap-2">
          {data.deliveries.map((d) => {
            const prop = data.properties.find((p) => p.id === d.propertyId);
            return (
              <li key={d.id} className="flex items-center justify-between gap-3 rounded-lg border border-foreground/10 p-3">
                <div>
                  <p className="text-sm font-medium">
                    {d.tipo === "entrega" ? "Entrega" : "Recepción"} {prop ? `— ${prop.title}` : ""}
                  </p>
                  <p className="text-xs text-foreground/50">
                    {new Date(d.createdAt).toLocaleDateString("es-CL")}
                    {isAdmin ? ` · ${brokerName(data, d.brokerId)}` : ""}
                  </p>
                </div>
                <a className={btnGhost} href={`/api/inmobiliaria/entregas/${d.id}/pdf${pdfSuffix}`} target="_blank" rel="noreferrer">
                  Descargar PDF
                </a>
              </li>
            );
          })}
          {data.deliveries.length === 0 && <p className="text-sm text-foreground/50">Sin informes todavía.</p>}
        </ul>
      </div>
    </div>
  );
}

// ---------- Contratos ----------

function ContractsTab({
  data,
  authHeaders,
  reload,
  pdfSuffix,
  isAdmin,
}: {
  data: Bundle;
  authHeaders: Record<string, string>;
  reload: () => void;
  pdfSuffix: string;
  isAdmin: boolean;
}) {
  const [templateName, setTemplateName] = useState("");
  const [templateOperation, setTemplateOperation] = useState("");
  const [templateBody, setTemplateBody] = useState("");
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [templateErr, setTemplateErr] = useState<string | null>(null);

  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [propertyId, setPropertyId] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [rendered, setRendered] = useState<string | null>(null);
  const [genBusy, setGenBusy] = useState(false);
  const [genErr, setGenErr] = useState<string | null>(null);

  const detectedVars = useMemo(() => [...new Set([...templateBody.matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g)].map((m) => m[1]))], [templateBody]);
  const selectedTemplate = data.contractTemplates.find((t) => t.id === selectedTemplateId);

  async function saveTemplate() {
    setSavingTemplate(true);
    setTemplateErr(null);
    try {
      await post("/api/inmobiliaria", authHeaders, { kind: "template", name: templateName, operation: templateOperation, body: templateBody });
      setTemplateName("");
      setTemplateOperation("");
      setTemplateBody("");
      reload();
    } catch (e) {
      setTemplateErr(e instanceof Error ? e.message : "Error");
    } finally {
      setSavingTemplate(false);
    }
  }

  async function generate() {
    if (!selectedTemplate) return;
    setGenBusy(true);
    setGenErr(null);
    try {
      const res = await post("/api/inmobiliaria", authHeaders, { kind: "contract", templateId: selectedTemplate.id, propertyId: propertyId || undefined, variables: values });
      setRendered(res.rendered);
      reload();
    } catch (e) {
      setGenErr(e instanceof Error ? e.message : "Error");
    } finally {
      setGenBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {isAdmin && (
        <div className={card}>
          <h3 className="mb-1 font-semibold">Plantillas de contrato</h3>
          <p className="mb-3 text-xs text-foreground/50">
            Pega acá el texto de tu contrato real (arriendo, venta, temporada...). Usa <code className="rounded bg-foreground/10 px-1">{"{{nombre_variable}}"}</code> donde
            quieras que se rellene un dato — el sistema detecta las variables solo. El texto legal es tuyo, esto solo lo deja listo para generar y descargar en PDF.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <input className={input} placeholder="Nombre de la plantilla" value={templateName} onChange={(e) => setTemplateName(e.target.value)} />
            <input className={input} placeholder="Tipo de operación (arriendo, venta...)" value={templateOperation} onChange={(e) => setTemplateOperation(e.target.value)} />
          </div>
          <textarea
            className={`${input} mt-3 font-mono text-xs`}
            placeholder={"En Viña del Mar, a {{fecha}}, entre {{nombre_arrendador}}... se acuerda..."}
            rows={10}
            value={templateBody}
            onChange={(e) => setTemplateBody(e.target.value)}
          />
          {detectedVars.length > 0 && (
            <p className="mt-2 text-xs text-foreground/50">Variables detectadas: {detectedVars.map((v) => `{{${v}}}`).join(", ")}</p>
          )}
          <button className={`${btnPrimary} mt-3`} disabled={savingTemplate || !templateName || !templateBody} onClick={saveTemplate}>
            Guardar plantilla
          </button>
          {templateErr && <p className="mt-2 text-sm text-red-600">{templateErr}</p>}

          {data.contractTemplates.length > 0 && (
            <ul className="mt-4 flex flex-col gap-2">
              {data.contractTemplates.map((t) => (
                <li key={t.id} className="flex items-center justify-between rounded-lg border border-foreground/10 p-3">
                  <div>
                    <p className="text-sm font-medium">{t.name}</p>
                    <p className="text-xs text-foreground/50">{t.operation}</p>
                  </div>
                  <button
                    className={btnGhost}
                    onClick={async () => {
                      if (!confirm("¿Eliminar esta plantilla?")) return;
                      await del("/api/inmobiliaria", authHeaders, { kind: "template", id: t.id });
                      reload();
                    }}
                  >
                    Eliminar
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className={card}>
        <h3 className="mb-3 font-semibold">Generar contrato</h3>
        {data.contractTemplates.length === 0 ? (
          <p className="text-sm text-foreground/50">{isAdmin ? "Crea una plantilla arriba primero." : "Todavía no hay plantillas cargadas por la administradora."}</p>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <select className={input} value={selectedTemplateId} onChange={(e) => setSelectedTemplateId(e.target.value)}>
                <option value="">Elegir plantilla…</option>
                {data.contractTemplates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              <select className={input} value={propertyId} onChange={(e) => setPropertyId(e.target.value)}>
                <option value="">Sin propiedad asociada</option>
                {data.properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </div>
            {selectedTemplate && (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {selectedTemplate.variables.map((v) => (
                  <input
                    key={v}
                    className={input}
                    placeholder={v}
                    value={values[v] ?? ""}
                    onChange={(e) => setValues((prev) => ({ ...prev, [v]: e.target.value }))}
                  />
                ))}
              </div>
            )}
            <button className={`${btnPrimary} mt-3`} disabled={!selectedTemplate || genBusy} onClick={generate}>
              Generar y previsualizar
            </button>
            {genErr && <p className="mt-2 text-sm text-red-600">{genErr}</p>}
            {rendered && <pre className="mt-3 whitespace-pre-wrap rounded-lg border border-foreground/10 bg-foreground/5 p-3 text-xs">{rendered}</pre>}
          </>
        )}
      </div>

      <div className={card}>
        <h3 className="mb-3 font-semibold">Contratos generados</h3>
        <ul className="flex flex-col gap-2">
          {data.contracts.map((c) => {
            const t = data.contractTemplates.find((x) => x.id === c.templateId);
            return (
              <li key={c.id} className="flex items-center justify-between gap-3 rounded-lg border border-foreground/10 p-3">
                <div>
                  <p className="text-sm font-medium">{t?.name ?? "Plantilla eliminada"}</p>
                  <p className="text-xs text-foreground/50">{new Date(c.createdAt).toLocaleDateString("es-CL")}</p>
                </div>
                <a className={btnGhost} href={`/api/inmobiliaria/contratos/${c.id}/pdf${pdfSuffix}`} target="_blank" rel="noreferrer">
                  Descargar PDF
                </a>
              </li>
            );
          })}
          {data.contracts.length === 0 && <p className="text-sm text-foreground/50">Sin contratos generados todavía.</p>}
        </ul>
      </div>
    </div>
  );
}
