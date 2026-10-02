import { clientConfig } from "@/config/client.config";
import { db, ensureSchema, hasDb, jsonb, withDb } from "@/lib/db";

// Almacén de reservas del módulo agenda.
//
// Con DATABASE_URL (Neon) las reservas viven en Postgres y son las mismas para
// todos los isolates de Vercel; la base garantiza además que dos personas no
// tomen la misma hora. Sin DATABASE_URL funciona en memoria (globalThis) con
// datos sembrados: así una demo arranca sin configurar nada y el panel del
// dueño nunca se ve vacío. Ver lib/db.ts.

export interface Booking {
  id: string;
  service: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  name: string;
  phone: string;
  // "pendiente_autorizacion": la reserva superó el tope diario de horas y
  // necesita que el dueño la autorice antes de seguir el flujo normal (abono).
  status: "pendiente" | "pendiente_autorizacion" | "confirmada" | "cancelada";
  // Duración reservada en minutos, fija al momento de crear la reserva.
  durationMinutes: number;
  // Qué profesional atiende esta reserva. SHARED_PROFESSIONAL_ID para clientes
  // que no usan `clientConfig.professionals` — un solo calendario, como antes.
  professionalId: string;
  // Sucursal donde se atiende (requiere modules.multiBranch). SHARED_BRANCH_ID
  // para clientes de una sola ubicación — igual que professionalId, el resto
  // del motor nunca necesita un camino especial para "sin sucursales".
  branchId: string;
  // Presente cuando el abono se pagó online con Webpay.
  payment?: { amount: number; authorizationCode?: string; cardLast4?: string };
  createdAt: string;
}

// Ficha de cliente: transversal a cualquier rubro que use esta Agenda
// (peluquería, barbería, dentista, abogado — el campo `notes` sirve para lo
// que cada uno necesite anotar: fórmula de color, historia clínica, apuntes
// del caso). Se auto-completa sola con cada reserva (ver
// upsertClientFromBooking) — el negocio nunca tiene que cargarla a mano,
// solo puede agregarle notas después desde el panel.
export interface Client {
  phone: string;
  name: string;
  email?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// Odontograma y presupuestos: solo para clínicas dentales
// (modules.dentalRecords), siempre colgando de una Client existente por
// `phone`. ToothCondition/FDI_TEETH viven en lib/dental.ts (sin
// dependencias de servidor) porque components/agenda/AdminAgenda.tsx
// ("use client") necesita FDI_TEETH como valor real en el navegador —
// importarlo desde ACÁ arrastraría todo este módulo (incluido postgres) al
// bundle del cliente.
export { FDI_TEETH } from "@/lib/dental";
export type { ToothCondition, PeriodontalMeasurement } from "@/lib/dental";
import type { ToothCondition, PeriodontalMeasurement } from "@/lib/dental";

export interface Odontogram {
  phone: string;
  // Clave = número FDI ("11".."48") como string. Un diente ausente del mapa
  // se interpreta como "sano" — así una ficha nueva no necesita escribir 32
  // entradas para no tener nada marcado.
  teeth: Record<string, ToothCondition>;
  updatedAt: string;
}

export interface Periodontogram {
  phone: string;
  // Clave = número FDI. Un diente ausente del mapa se interpreta como "sin
  // medir" (a diferencia de Odontogram.teeth, acá no hay default clínico).
  teeth: Record<string, PeriodontalMeasurement>;
  updatedAt: string;
}

export interface BudgetItem {
  description: string;
  tooth?: string; // número FDI, opcional (no todo ítem de un presupuesto es por diente — ej. limpieza general)
  price: number;
}

export interface Budget {
  id: string;
  phone: string;
  items: BudgetItem[];
  total: number; // suma de items — SIEMPRE calculado en el servidor, nunca confiar en lo que mande el cliente
  status: "pendiente" | "aceptado" | "rechazado";
  createdAt: string;
}

// Control de pagos: abonos/pagos contra un presupuesto (o sueltos, sin
// presupuesto asociado — ej. venta de un producto puntual). El saldo de un
// presupuesto (total - pagado) se calcula siempre en el momento, nunca se
// guarda — así nunca queda desincronizado si se edita o borra un pago.
export interface Payment {
  id: string;
  phone: string;
  budgetId?: string;
  amount: number;
  method: "efectivo" | "tarjeta" | "transferencia" | "otro";
  note?: string;
  createdAt: string;
}

// Gastos e inventario (requiere modules.expenses) — transversal a cualquier
// rubro que use la Agenda, no cuelga de ninguna ficha de cliente. Sección
// propia del panel, separada de dental/pagos.
export interface Expense {
  id: string;
  date: string; // YYYY-MM-DD
  category: string;
  description: string;
  amount: number;
  createdAt: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  unit: string; // "unidad", "caja", "ml", "kg"... texto libre, cada negocio lo suyo
  quantity: number;
  minStock?: number; // bajo este número el panel lo marca en rojo
  updatedAt: string;
}

export interface Professional {
  id: string;
  name: string;
  photoUrl?: string;
  email?: string;
  services?: string[];
  // % de comisión sobre el precio del servicio (requiere modules.expenses —
  // vive junto a lo financiero, no es un dato "operativo" como el resto de
  // Professional). Sin definir = 0%, no aparece en el reporte de comisiones.
  commissionPercent?: number;
  // Sucursal a la que pertenece (requiere modules.multiBranch). Sin definir,
  // atiende en TODAS las sucursales — así activar el módulo nunca hace
  // desaparecer de golpe a un profesional que todavía no se le asignó una.
  branchId?: string;
}

// Sucursal (requiere modules.multiBranch). "puede ser 1 o +": sin ninguna
// agregada, listBranches() devuelve una sola implícita (SHARED_BRANCH_ID) y
// todo el motor de disponibilidad se comporta exactamente igual que sin el
// módulo — recién con 2+ aparecen los selectores en el panel y en /agenda.
export interface Branch {
  id: string;
  name: string;
  address?: string;
}

export interface DayHoursOverride {
  open?: string;
  close?: string;
  closed?: boolean;
}

// Calendario único de siempre, para clientes sin profesionales configurados
// — ver la nota en lib/db.ts sobre por qué es un string fijo y no NULL.
export const SHARED_PROFESSIONAL_ID = "_shared";
// Sucursal única implícita — mismo rol que SHARED_PROFESSIONAL_ID pero para
// ubicación: negocios que nunca tocan "Sucursales" en el panel operan sobre
// este id sin saber que existe.
export const SHARED_BRANCH_ID = "_shared";

// `client.config.ts` es solo la SEMILLA inicial de profesionales y horario —
// nunca la fuente de verdad en vivo. El dueño los agrega/edita desde el panel
// (guardado en `settings`, igual que duración/precio/tope diario) sin tocar
// el config ni redesplegar. Ver getProfessionalsOverride/getHoursOverride.

// Config-only, SIN el override guardado — únicamente para sembrar datos de
// demo en memoria (seed()), donde por definición todavía no existe override.
function configProfessionals(service?: string): Professional[] {
  const configured = clientConfig.professionals ?? [];
  if (configured.length === 0) return [{ id: SHARED_PROFESSIONAL_ID, name: clientConfig.meta.businessName }];
  if (!service) return configured;
  return configured.filter((p) => !p.services?.length || p.services.includes(service));
}

export async function getProfessionalsOverride(): Promise<Professional[] | null> {
  return withDb(
    async () => {
      const sql = db();
      const rows = await sql`SELECT value FROM settings WHERE key = 'professionals' LIMIT 1`;
      return (rows[0]?.value as Professional[] | undefined) ?? null;
    },
    () => store().professionalsOverride ?? null
  );
}

export async function setProfessionalsOverride(list: Professional[]): Promise<void> {
  await withDb(
    async () => {
      const sql = db();
      await sql`
        INSERT INTO settings (key, value) VALUES ('professionals', ${jsonb(list)})
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
      `;
    },
    () => {
      store().professionalsOverride = [...list];
    }
  );
}

export async function multiProfessionalEnabled(): Promise<boolean> {
  const override = await getProfessionalsOverride();
  return (override ?? clientConfig.professionals ?? []).length > 0;
}

// Profesionales elegibles para un servicio (o todos, sin filtrar por
// servicio) y, opcionalmente, para una sucursal. Sin ninguno configurado (ni
// override ni config), es un único profesional implícito que representa al
// negocio completo — así el resto del motor (buildSlots, createBooking) no
// necesita un camino especial para el caso "agenda compartida": simplemente
// hay un solo id posible. Un profesional SIN branchId asignado atiende en
// cualquier sucursal (ver nota en Professional.branchId).
export async function eligibleProfessionals(service?: string, branchId?: string): Promise<Professional[]> {
  const override = await getProfessionalsOverride();
  const configured = override ?? clientConfig.professionals ?? [];
  let list: Professional[] =
    configured.length === 0 ? [{ id: SHARED_PROFESSIONAL_ID, name: clientConfig.meta.businessName }] : configured;
  if (service) list = list.filter((p) => !p.services?.length || p.services.includes(service));
  // "any" (igual que professionalId en slotsForDate/createBooking): "sin
  // sucursal elegida todavía" — nunca debe filtrar como si fuera un id real.
  // SHARED_BRANCH_ID SÍ filtra: una vez que multiBranch está en uso, es una
  // sucursal real como cualquier otra (la implícita/default), no un "sin
  // filtro" — de lo contrario un profesional de OTRA sucursal se colaría en
  // ella. Backward-compat queda intacta igual: un profesional sin branchId
  // (el caso de todo cliente que nunca activó multiBranch) siempre calza.
  if (branchId && branchId !== "any") {
    list = list.filter((p) => !p.branchId || p.branchId === branchId);
  }
  return list;
}

// --- Sucursales (requiere modules.multiBranch) — mismo patrón de storage que
// professionals (JSON en `settings`), ver getProfessionalsOverride arriba.
export async function getBranchesOverride(): Promise<Branch[] | null> {
  return withDb(
    async () => {
      const sql = db();
      const rows = await sql`SELECT value FROM settings WHERE key = 'branches' LIMIT 1`;
      return (rows[0]?.value as Branch[] | undefined) ?? null;
    },
    () => store().branchesOverride ?? null
  );
}

export async function setBranchesOverride(list: Branch[]): Promise<void> {
  await withDb(
    async () => {
      const sql = db();
      await sql`
        INSERT INTO settings (key, value) VALUES ('branches', ${jsonb(list)})
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
      `;
    },
    () => {
      store().branchesOverride = [...list];
    }
  );
}

// Sin ninguna sucursal agregada todavía, hay una sola implícita — "puede ser
// 1 o +" sin que el resto del motor necesite dos caminos distintos.
export async function listBranches(): Promise<Branch[]> {
  const override = await getBranchesOverride();
  if (!override || override.length === 0) return [{ id: SHARED_BRANCH_ID, name: clientConfig.meta.businessName }];
  return override;
}

export async function multiBranchEnabled(): Promise<boolean> {
  return (await listBranches()).length > 1;
}

// Con qué profesional se calza la sesión de alguien que entra al panel — así
// el staff ve y gestiona SOLO sus propias reservas. Requiere que el correo de
// su login (admin.users) sea EXACTAMENTE el mismo que en professionals[].email.
export async function professionalIdForEmail(email: string): Promise<string | null> {
  const list = await eligibleProfessionals();
  return list.find((p) => p.email?.toLowerCase() === email.toLowerCase())?.id ?? null;
}

// Nombre para mostrar en avisos/panel — null en agenda compartida (mostrar
// "con Mi Negocio" sería ruido, no información).
export async function professionalDisplayName(id: string): Promise<string | null> {
  if (id === SHARED_PROFESSIONAL_ID) return null;
  const list = await eligibleProfessionals();
  return list.find((p) => p.id === id)?.name ?? null;
}

interface Store {
  bookings: Booking[];
  clients: Client[];
  odontograms: Odontogram[];
  periodontograms: Periodontogram[];
  budgets: Budget[];
  payments: Payment[];
  expenses: Expense[];
  inventory: InventoryItem[];
  // "YYYY-MM-DD" bloquea el día completo; "YYYY-MM-DD HH:mm" bloquea una hora.
  blocked: string[];
  // Espejo de `blocked` en sentido contrario: horas "YYYY-MM-DD HH:mm"
  // (opcional "|profId") que se ofrecen EXTRA más allá del horario normal.
  extraSlots: string[];
  // Destinos de aviso configurables desde el panel (para la demo en vivo y para
  // que el negocio los cambie sin tocar variables de entorno).
  notify: { email?: string; whatsapp?: string };
  notifyQuota?: { date: string; sent: number };
  // Duración, precio por servicio y tope diario configurables desde el panel,
  // sin tocar el config ni redesplegar. Ausente = usa lo que trae el config.
  serviceDurations: Record<string, number>;
  servicePrices: Record<string, string>;
  maxDailyMinutes?: number;
  // Minutos mínimos de anticipación exigidos para reservar (0 = sin mínimo),
  // configurable desde el panel del dueño.
  minLeadMinutes: number;
  // Profesionales, sucursales y horario de atención configurables desde el
  // panel, sin tocar el config ni redesplegar. Ausente = usa lo que trae el
  // config. hoursOverrideByBranch va indexado por branchId (SHARED_BRANCH_ID
  // para el horario "de siempre", sin sucursales).
  professionalsOverride?: Professional[];
  branchesOverride?: Branch[];
  hoursOverrideByBranch: Record<string, DayHoursOverride[]>;
  seeded: boolean;
}

const g = globalThis as unknown as { __bookingStore?: Store };

function store(): Store {
  if (!g.__bookingStore) {
    g.__bookingStore = {
      bookings: [],
      clients: [],
      odontograms: [],
      periodontograms: [],
      budgets: [],
      payments: [],
      expenses: [],
      inventory: [],
      blocked: [],
      extraSlots: [],
      notify: {},
      serviceDurations: {},
      servicePrices: {},
      minLeadMinutes: 0,
      hoursOverrideByBranch: {},
      seeded: false,
    };
    // Los datos de ejemplo son para las demos. Un cliente real con base de
    // datos jamás debe ver reservas inventadas en su panel.
    if (!hasDb()) seed(g.__bookingStore);
  }
  return g.__bookingStore;
}

// createBooking necesita distinguir el choque de horario de otros errores, así
// que no usa withDb (que degrada a memoria en silencio) sino este envoltorio.
async function ensureSchemaThen(operation: () => Promise<void>): Promise<void> {
  await ensureSchema();
  await operation();
}

// Fila de Postgres → Booking.
function rowToBooking(r: Record<string, unknown>): Booking {
  return {
    id: String(r.id),
    service: String(r.service),
    date: String(r.date),
    time: String(r.time),
    name: String(r.name),
    phone: String(r.phone),
    status: r.status as Booking["status"],
    durationMinutes: Number(r.duration_minutes ?? clientConfig.booking?.slotMinutes ?? 60),
    professionalId: String(r.professional_id ?? SHARED_PROFESSIONAL_ID),
    branchId: String(r.branch_id ?? SHARED_BRANCH_ID),
    payment: (r.payment as Booking["payment"]) ?? undefined,
    createdAt: new Date(r.created_at as string).toISOString(),
  };
}

function rowToClient(r: Record<string, unknown>): Client {
  return {
    phone: String(r.phone),
    name: String(r.name),
    email: (r.email as string) ?? undefined,
    notes: (r.notes as string) ?? undefined,
    createdAt: new Date(r.created_at as string).toISOString(),
    updatedAt: new Date((r.updated_at as string) ?? (r.created_at as string)).toISOString(),
  };
}

// Se llama sola tras cada reserva exitosa (ver insertBooking) — nunca hace
// falta cargar un cliente a mano. Actualiza el nombre al más reciente que dio
// (por si lo escribió distinto la primera vez) pero NUNCA pisa las notas que
// el negocio ya haya escrito.
async function upsertClientFromBooking(phone: string, name: string): Promise<void> {
  const now = new Date().toISOString();
  await withDb(
    async () => {
      const sql = db();
      await sql`
        INSERT INTO clients (phone, name, created_at, updated_at)
        VALUES (${phone}, ${name}, ${now}, ${now})
        ON CONFLICT (phone) DO UPDATE SET name = EXCLUDED.name, updated_at = ${now}
      `;
    },
    () => {
      const existing = store().clients.find((c) => c.phone === phone);
      if (existing) {
        existing.name = name;
        existing.updatedAt = now;
      } else {
        store().clients.push({ phone, name, createdAt: now, updatedAt: now });
      }
    }
  );
}

export async function listClients(): Promise<Client[]> {
  return withDb(
    async () => {
      const sql = db();
      const rows = await sql`SELECT * FROM clients ORDER BY updated_at DESC`;
      return rows.map(rowToClient);
    },
    () => [...store().clients].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  );
}

// Lo único que el negocio realmente edita a mano en la ficha — el resto se
// mantiene solo con cada reserva.
export async function updateClientNotes(phone: string, notes: string): Promise<void> {
  const now = new Date().toISOString();
  await withDb(
    async () => {
      const sql = db();
      await sql`UPDATE clients SET notes = ${notes}, updated_at = ${now} WHERE phone = ${phone}`;
    },
    () => {
      const c = store().clients.find((x) => x.phone === phone);
      if (c) {
        c.notes = notes;
        c.updatedAt = now;
      }
    }
  );
}

// ---------- Odontograma (solo modules.dentalRecords) ----------

function rowToOdontogram(r: Record<string, unknown>): Odontogram {
  return {
    phone: String(r.phone),
    teeth: (r.teeth as Record<string, ToothCondition>) ?? {},
    updatedAt: new Date(r.updated_at as string).toISOString(),
  };
}

export async function listOdontograms(): Promise<Odontogram[]> {
  return withDb(
    async () => {
      const sql = db();
      const rows = await sql`SELECT * FROM odontograms`;
      return rows.map(rowToOdontogram);
    },
    () => [...store().odontograms]
  );
}

// Un diente a la vez (clic en el odontograma) — se guarda solo, sin botón
// "Guardar" aparte, mergeando dentro del mismo mapa JSONB.
export async function setToothCondition(phone: string, tooth: string, condition: ToothCondition): Promise<void> {
  const now = new Date().toISOString();
  await withDb(
    async () => {
      const sql = db();
      const rows = await sql`SELECT teeth FROM odontograms WHERE phone = ${phone} LIMIT 1`;
      const teeth = { ...((rows[0]?.teeth as Record<string, ToothCondition>) ?? {}), [tooth]: condition };
      await sql`
        INSERT INTO odontograms (phone, teeth, updated_at)
        VALUES (${phone}, ${jsonb(teeth)}, ${now})
        ON CONFLICT (phone) DO UPDATE SET teeth = EXCLUDED.teeth, updated_at = EXCLUDED.updated_at
      `;
    },
    () => {
      const existing = store().odontograms.find((o) => o.phone === phone);
      if (existing) {
        existing.teeth[tooth] = condition;
        existing.updatedAt = now;
      } else {
        store().odontograms.push({ phone, teeth: { [tooth]: condition }, updatedAt: now });
      }
    }
  );
}

// ---------- Periodontograma (solo modules.dentalRecords) ----------

function rowToPeriodontogram(r: Record<string, unknown>): Periodontogram {
  return {
    phone: String(r.phone),
    teeth: (r.teeth as Record<string, PeriodontalMeasurement>) ?? {},
    updatedAt: new Date(r.updated_at as string).toISOString(),
  };
}

export async function listPeriodontograms(): Promise<Periodontogram[]> {
  return withDb(
    async () => {
      const sql = db();
      const rows = await sql`SELECT * FROM periodontograms`;
      return rows.map(rowToPeriodontogram);
    },
    () => [...store().periodontograms]
  );
}

// Un diente a la vez (clic en el periodontograma) — mismo patrón que
// setToothCondition: sin botón "Guardar" aparte, mergea en el mismo JSONB.
export async function setPeriodontalTooth(phone: string, tooth: string, data: PeriodontalMeasurement): Promise<void> {
  const now = new Date().toISOString();
  await withDb(
    async () => {
      const sql = db();
      const rows = await sql`SELECT teeth FROM periodontograms WHERE phone = ${phone} LIMIT 1`;
      const teeth = { ...((rows[0]?.teeth as Record<string, PeriodontalMeasurement>) ?? {}), [tooth]: data };
      await sql`
        INSERT INTO periodontograms (phone, teeth, updated_at)
        VALUES (${phone}, ${jsonb(teeth)}, ${now})
        ON CONFLICT (phone) DO UPDATE SET teeth = EXCLUDED.teeth, updated_at = EXCLUDED.updated_at
      `;
    },
    () => {
      const existing = store().periodontograms.find((o) => o.phone === phone);
      if (existing) {
        existing.teeth[tooth] = data;
        existing.updatedAt = now;
      } else {
        store().periodontograms.push({ phone, teeth: { [tooth]: data }, updatedAt: now });
      }
    }
  );
}

// ---------- Presupuestos (solo modules.dentalRecords) ----------

function rowToBudget(r: Record<string, unknown>): Budget {
  return {
    id: String(r.id),
    phone: String(r.phone),
    items: (r.items as BudgetItem[]) ?? [],
    total: Number(r.total),
    status: r.status as Budget["status"],
    createdAt: new Date(r.created_at as string).toISOString(),
  };
}

export async function listBudgets(): Promise<Budget[]> {
  return withDb(
    async () => {
      const sql = db();
      const rows = await sql`SELECT * FROM budgets ORDER BY created_at DESC`;
      return rows.map(rowToBudget);
    },
    () => [...store().budgets].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  );
}

export async function addBudget(phone: string, items: BudgetItem[]): Promise<Budget> {
  const total = items.reduce((sum, i) => sum + i.price, 0);
  const b: Budget = { id: randomId(), phone, items, total, status: "pendiente", createdAt: new Date().toISOString() };
  await withDb(
    async () => {
      const sql = db();
      await sql`
        INSERT INTO budgets (id, phone, items, total, status, created_at)
        VALUES (${b.id}, ${b.phone}, ${jsonb(b.items)}, ${b.total}, ${b.status}, ${b.createdAt})
      `;
    },
    () => {
      store().budgets.push(b);
    }
  );
  return b;
}

export async function updateBudgetStatus(id: string, status: Budget["status"]): Promise<void> {
  await withDb(
    async () => {
      const sql = db();
      await sql`UPDATE budgets SET status = ${status} WHERE id = ${id}`;
    },
    () => {
      const b = store().budgets.find((x) => x.id === id);
      if (b) b.status = status;
    }
  );
}

function randomId(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

// ---------- Pagos (solo modules.dentalRecords) ----------

function rowToPayment(r: Record<string, unknown>): Payment {
  return {
    id: String(r.id),
    phone: String(r.phone),
    budgetId: (r.budget_id as string) ?? undefined,
    amount: Number(r.amount),
    method: r.method as Payment["method"],
    note: (r.note as string) ?? undefined,
    createdAt: new Date(r.created_at as string).toISOString(),
  };
}

export async function listPayments(): Promise<Payment[]> {
  return withDb(
    async () => {
      const sql = db();
      const rows = await sql`SELECT * FROM payments ORDER BY created_at DESC`;
      return rows.map(rowToPayment);
    },
    () => [...store().payments].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  );
}

export async function addPayment(data: { phone: string; budgetId?: string; amount: number; method: Payment["method"]; note?: string }): Promise<Payment> {
  const p: Payment = { ...data, id: randomId(), createdAt: new Date().toISOString() };
  await withDb(
    async () => {
      const sql = db();
      await sql`
        INSERT INTO payments (id, phone, budget_id, amount, method, note, created_at)
        VALUES (${p.id}, ${p.phone}, ${p.budgetId ?? null}, ${p.amount}, ${p.method}, ${p.note ?? null}, ${p.createdAt})
      `;
    },
    () => {
      store().payments.push(p);
    }
  );
  return p;
}

// ---------- Gastos e inventario (solo modules.expenses) ----------

function rowToExpense(r: Record<string, unknown>): Expense {
  return {
    id: String(r.id),
    date: String(r.date),
    category: String(r.category),
    description: String(r.description),
    amount: Number(r.amount),
    createdAt: new Date(r.created_at as string).toISOString(),
  };
}

export async function listExpenses(): Promise<Expense[]> {
  return withDb(
    async () => {
      const sql = db();
      const rows = await sql`SELECT * FROM expenses ORDER BY date DESC`;
      return rows.map(rowToExpense);
    },
    () => [...store().expenses].sort((a, b) => b.date.localeCompare(a.date))
  );
}

export async function addExpense(data: Omit<Expense, "id" | "createdAt">): Promise<Expense> {
  const e: Expense = { ...data, id: randomId(), createdAt: new Date().toISOString() };
  await withDb(
    async () => {
      const sql = db();
      await sql`
        INSERT INTO expenses (id, date, category, description, amount, created_at)
        VALUES (${e.id}, ${e.date}, ${e.category}, ${e.description}, ${e.amount}, ${e.createdAt})
      `;
    },
    () => {
      store().expenses.push(e);
    }
  );
  return e;
}

export async function deleteExpense(id: string): Promise<void> {
  await withDb(
    async () => {
      const sql = db();
      await sql`DELETE FROM expenses WHERE id = ${id}`;
    },
    () => {
      store().expenses = store().expenses.filter((e) => e.id !== id);
    }
  );
}

function rowToInventoryItem(r: Record<string, unknown>): InventoryItem {
  return {
    id: String(r.id),
    name: String(r.name),
    unit: String(r.unit),
    quantity: Number(r.quantity),
    minStock: r.min_stock === null || r.min_stock === undefined ? undefined : Number(r.min_stock),
    updatedAt: new Date(r.updated_at as string).toISOString(),
  };
}

export async function listInventory(): Promise<InventoryItem[]> {
  return withDb(
    async () => {
      const sql = db();
      const rows = await sql`SELECT * FROM inventory_items ORDER BY name ASC`;
      return rows.map(rowToInventoryItem);
    },
    () => [...store().inventory].sort((a, b) => a.name.localeCompare(b.name))
  );
}

export async function addInventoryItem(data: { name: string; unit: string; quantity: number; minStock?: number }): Promise<InventoryItem> {
  const item: InventoryItem = { ...data, id: randomId(), updatedAt: new Date().toISOString() };
  await withDb(
    async () => {
      const sql = db();
      await sql`
        INSERT INTO inventory_items (id, name, unit, quantity, min_stock, updated_at)
        VALUES (${item.id}, ${item.name}, ${item.unit}, ${item.quantity}, ${item.minStock ?? null}, ${item.updatedAt})
      `;
    },
    () => {
      store().inventory.push(item);
    }
  );
  return item;
}

// delta positivo = entrada de stock, negativo = salida/consumo.
export async function adjustInventoryQuantity(id: string, delta: number): Promise<void> {
  const now = new Date().toISOString();
  await withDb(
    async () => {
      const sql = db();
      await sql`UPDATE inventory_items SET quantity = quantity + ${delta}, updated_at = ${now} WHERE id = ${id}`;
    },
    () => {
      const item = store().inventory.find((i) => i.id === id);
      if (item) {
        item.quantity += delta;
        item.updatedAt = now;
      }
    }
  );
}

export async function deleteInventoryItem(id: string): Promise<void> {
  await withDb(
    async () => {
      const sql = db();
      await sql`DELETE FROM inventory_items WHERE id = ${id}`;
    },
    () => {
      store().inventory = store().inventory.filter((i) => i.id !== id);
    }
  );
}

// Datos de ejemplo para que el panel del dueño nunca se vea vacío en la demo.
function seed(s: Store) {
  if (s.seeded) return;
  const d = (offset: number) => {
    const date = new Date();
    date.setDate(date.getDate() + offset);
    return date.toISOString().slice(0, 10);
  };
  const services = clientConfig.services.map((x) => x.title);
  const svc = (i: number) => services[i % Math.max(services.length, 1)] ?? "Servicio";
  const dur = (title: string) => configDurationFor(title);
  const firstProfessional = configProfessionals()[0]?.id ?? SHARED_PROFESSIONAL_ID;
  s.bookings.push(
    { id: "demo-1", service: svc(0), date: d(1), time: "11:00", name: "Camila R.", phone: "+56 9 5555 1111", status: "pendiente", durationMinutes: dur(svc(0)), professionalId: firstProfessional, branchId: SHARED_BRANCH_ID, createdAt: new Date().toISOString() },
    { id: "demo-2", service: svc(1), date: d(1), time: "15:00", name: "Fernanda M.", phone: "+56 9 5555 2222", status: "confirmada", durationMinutes: dur(svc(1)), professionalId: firstProfessional, branchId: SHARED_BRANCH_ID, createdAt: new Date().toISOString() },
    { id: "demo-3", service: svc(4), date: d(2), time: "10:00", name: "Valentina S.", phone: "+56 9 5555 3333", status: "confirmada", durationMinutes: dur(svc(4)), professionalId: firstProfessional, branchId: SHARED_BRANCH_ID, createdAt: new Date().toISOString() }
  );
  s.blocked.push(d(3)); // un día bloqueado de ejemplo
  if (clientConfig.booking?.ownerNotifyWhatsapp) {
    s.notify.whatsapp = clientConfig.booking.ownerNotifyWhatsapp;
  }
  if (clientConfig.booking?.ownerNotifyEmail) {
    s.notify.email = clientConfig.booking.ownerNotifyEmail;
  }
  s.seeded = true;
}

const DAY_NAMES = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

// Sin tildes ni mayúsculas, para comparar "miércoles"/"Miercoles"/"sábado" parejo.
function normalizeDay(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

const DAY_NAMES_NORM = DAY_NAMES.map(normalizeDay);

// ¿El día `dayIdx` (0=domingo) calza con una etiqueta como "Lunes a viernes",
// "Martes a sábado", "Lunes y domingo" o "Jueves"? Los rangos "X a Y" se expanden
// de verdad (incluye los días intermedios) y soportan cruce de semana
// ("Viernes a lunes"); cualquier otra etiqueta calza si menciona el día.
function dayMatchesLabel(dayIdx: number, label: string): boolean {
  const l = normalizeDay(label);
  const range = l.match(/([a-z]+)\s+a\s+([a-z]+)/);
  if (range) {
    const from = DAY_NAMES_NORM.indexOf(range[1]);
    const to = DAY_NAMES_NORM.indexOf(range[2]);
    if (from >= 0 && to >= 0) {
      return from <= to ? dayIdx >= from && dayIdx <= to : dayIdx >= from || dayIdx <= to;
    }
  }
  return l.includes(DAY_NAMES_NORM[dayIdx]);
}

// Horario efectivo para una fecha. Con override guardado (7 posiciones,
// índice = getDay(), 0=domingo), manda ese. Sin override, cae al horario
// "de fábrica" del config (etiquetas flexibles tipo "Lunes a viernes") — el
// mismo comportamiento de siempre para clientes que nunca tocaron el panel.
function hoursForDate(date: string, override: DayHoursOverride[] | null): { open: string; close: string } | null {
  const dayIdx = new Date(date + "T12:00:00").getDay();
  if (override) {
    const h = override[dayIdx];
    if (!h || h.closed || !h.open || !h.close) return null;
    return { open: h.open, close: h.close };
  }
  for (const h of clientConfig.contact.hours ?? []) {
    if (dayMatchesLabel(dayIdx, h.day)) {
      if (h.closed || !h.open || !h.close) return null;
      return { open: h.open, close: h.close };
    }
  }
  return null;
}

// Lo que el config "de fábrica" dice para cada día de la semana (domingo a
// sábado), para precargar el formulario de horario del panel la primera vez
// que alguien lo abre — mejor mostrar lo que ya rige que un formulario vacío.
function configHoursForWeek(): DayHoursOverride[] {
  return DAY_NAMES.map((_, dayIdx) => {
    for (const h of clientConfig.contact.hours ?? []) {
      if (dayMatchesLabel(dayIdx, h.day)) {
        return h.closed || !h.open || !h.close ? { closed: true } : { open: h.open, close: h.close };
      }
    }
    return { closed: true };
  });
}

// Sin branchId (o SHARED_BRANCH_ID), usa la misma key 'hours' de siempre —
// un cliente de una sola ubicación que nunca activó multiBranch nunca migra
// de key ni pierde el horario que ya tenía guardado.
function hoursSettingsKey(branchId?: string): string {
  return branchId && branchId !== SHARED_BRANCH_ID ? `hours_${branchId}` : "hours";
}

export async function getHoursOverride(branchId?: string): Promise<DayHoursOverride[] | null> {
  const key = hoursSettingsKey(branchId);
  return withDb(
    async () => {
      const sql = db();
      const rows = await sql`SELECT value FROM settings WHERE key = ${key} LIMIT 1`;
      return (rows[0]?.value as DayHoursOverride[] | undefined) ?? null;
    },
    () => store().hoursOverrideByBranch[branchId ?? SHARED_BRANCH_ID] ?? null
  );
}

// `hours` debe traer exactamente 7 posiciones (domingo a sábado, mismo orden
// que Date.getDay()) — lo arma el formulario del panel, no texto libre.
export async function setHoursOverride(hours: DayHoursOverride[], branchId?: string): Promise<void> {
  const key = hoursSettingsKey(branchId);
  await withDb(
    async () => {
      const sql = db();
      await sql`
        INSERT INTO settings (key, value) VALUES (${key}, ${jsonb(hours)})
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
      `;
    },
    () => {
      store().hoursOverrideByBranch[branchId ?? SHARED_BRANCH_ID] = [...hours];
    }
  );
}

// Horario a mostrar en el panel: lo guardado para esa sucursal, o si nunca se
// ha tocado, lo que ya rige por el config — así el formulario nunca aparece
// vacío. Sin branchId, es el horario "de siempre" (una sola ubicación).
export async function effectiveHoursForWeek(branchId?: string): Promise<DayHoursOverride[]> {
  return (await getHoursOverride(branchId)) ?? configHoursForWeek();
}

// Duración del servicio según el config (icono/precio/etc.), sin considerar
// aún el override que el dueño pueda haber guardado desde el panel.
function configDurationFor(service: string): number {
  const svc = clientConfig.services.find((s) => s.title === service);
  return svc?.durationMinutes ?? clientConfig.booking?.slotMinutes ?? 60;
}

// Duración efectiva de un servicio: lo que el dueño haya guardado desde el
// panel manda sobre el config (así puede ajustarla sin redesplegar el sitio).
export async function durationFor(service: string): Promise<number> {
  const overrides = await getServiceDurations();
  return overrides[service] ?? configDurationFor(service);
}

export async function getServiceDurations(): Promise<Record<string, number>> {
  return withDb(
    async () => {
      const sql = db();
      const rows = await sql`SELECT value FROM settings WHERE key = 'serviceDurations' LIMIT 1`;
      return (rows[0]?.value as Record<string, number>) ?? {};
    },
    () => ({ ...store().serviceDurations })
  );
}

export async function setServiceDurations(durations: Record<string, number>): Promise<void> {
  await withDb(
    async () => {
      const sql = db();
      await sql`
        INSERT INTO settings (key, value) VALUES ('serviceDurations', ${jsonb(durations)})
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
      `;
    },
    () => {
      store().serviceDurations = { ...durations };
    }
  );
}

// Precio efectivo de un servicio: lo que el dueño haya guardado desde el panel
// manda sobre el config. Texto libre (igual que en el config: "$5.990",
// "Desde $3.500") — no es el monto que se cobra en ningún pago, solo lo que se
// muestra en la home y en la agenda.
export async function priceFor(service: string): Promise<string | undefined> {
  const overrides = await getServicePrices();
  const configPrice = clientConfig.services.find((s) => s.title === service)?.price;
  return overrides[service] ?? configPrice;
}

export async function getServicePrices(): Promise<Record<string, string>> {
  return withDb(
    async () => {
      const sql = db();
      const rows = await sql`SELECT value FROM settings WHERE key = 'servicePrices' LIMIT 1`;
      return (rows[0]?.value as Record<string, string>) ?? {};
    },
    () => ({ ...store().servicePrices })
  );
}

export async function setServicePrices(prices: Record<string, string>): Promise<void> {
  await withDb(
    async () => {
      const sql = db();
      await sql`
        INSERT INTO settings (key, value) VALUES ('servicePrices', ${jsonb(prices)})
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
      `;
    },
    () => {
      store().servicePrices = { ...prices };
    }
  );
}

export async function getMaxDailyMinutes(): Promise<number | undefined> {
  return withDb(
    async () => {
      const sql = db();
      const rows = await sql`SELECT value FROM settings WHERE key = 'maxDailyMinutes' LIMIT 1`;
      const v = rows[0]?.value as { minutes?: number } | undefined;
      return v?.minutes;
    },
    () => store().maxDailyMinutes
  );
}

export async function setMaxDailyMinutes(minutes: number | undefined): Promise<void> {
  await withDb(
    async () => {
      const sql = db();
      await sql`
        INSERT INTO settings (key, value) VALUES ('maxDailyMinutes', ${jsonb({ minutes })})
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
      `;
    },
    () => {
      store().maxDailyMinutes = minutes;
    }
  );
}

// Tope diario efectivo: lo guardado desde el panel manda sobre el config.
// Sin ninguno de los dos, no hay tope (undefined).
async function effectiveMaxDailyMinutes(): Promise<number | undefined> {
  const override = await getMaxDailyMinutes();
  return override ?? clientConfig.booking?.maxDailyMinutes;
}

function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

const TZ = "America/Santiago";

// "Ahora + N minutos" expresado en fecha/hora local del negocio, para comparar
// contra los mismos strings "YYYY-MM-DD" / "HH:mm" que usan los slots. La
// aritmética corre sobre el instante UTC (Date.now()) y solo se formatea a
// horario de Chile al final, así que un cambio de horario de verano a mitad de
// camino no desalinea la comparación.
function nowPlusMinutes(minutes: number): { date: string; time: string } {
  const t = new Date(Date.now() + minutes * 60_000);
  return {
    date: new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(t),
    time: new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(t),
  };
}

export async function getMinLeadMinutes(): Promise<number> {
  return withDb(
    async () => {
      const sql = db();
      const rows = await sql`SELECT value FROM settings WHERE key = 'min_lead_minutes' LIMIT 1`;
      const v = rows[0]?.value as { minutes?: number } | undefined;
      return v?.minutes ?? 0;
    },
    () => store().minLeadMinutes
  );
}

// Ej: 90 evita que a las 15:50 se pueda reservar el bloque de las 16:00 — solo
// quedan disponibles los horarios a partir de las 17:20. 0 (default) solo
// excluye los horarios que ya pasaron hoy — nunca se ofrece una hora anterior
// a la actual, con o sin mínimo configurado.
export async function setMinLeadMinutes(minutes: number): Promise<void> {
  const clamped = Math.max(0, Math.min(1440, Math.round(minutes)));
  await withDb(
    async () => {
      const sql = db();
      await sql`
        INSERT INTO settings (key, value) VALUES ('min_lead_minutes', ${jsonb({ minutes: clamped })})
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
      `;
    },
    () => {
      store().minLeadMinutes = clamped;
    }
  );
}

// Bloqueos: "YYYY-MM-DD" o "YYYY-MM-DD HH:mm" = bloquea a TODO el negocio (de
// siempre); agregar "|profId" al final escopa el bloqueo a un solo
// profesional (su día libre, sin afectar la agenda de los demás).
function dayBlocked(date: string, profId: string, blocked: Set<string>): boolean {
  return blocked.has(date) || blocked.has(`${date}|${profId}`);
}
function timeBlocked(date: string, time: string, profId: string, blocked: Set<string>): boolean {
  return blocked.has(`${date} ${time}`) || blocked.has(`${date} ${time}|${profId}`);
}

// Espejo de timeBlocked: horas "YYYY-MM-DD HH:mm" (opcional "|profId") que se
// ofrecen EXTRA ese día para ese profesional, más allá de la grilla normal.
function extraTimesFor(date: string, profId: string, extra: Set<string>): string[] {
  const times = new Set<string>();
  for (const key of extra) {
    const [base, scopedProf] = key.split("|");
    if (scopedProf && scopedProf !== profId) continue;
    if (!base.startsWith(`${date} `)) continue;
    times.add(base.slice(date.length + 1));
  }
  return [...times];
}

// Genera la grilla de horarios del día PARA UN PROFESIONAL y marca cuáles
// siguen libres. Cada servicio puede durar más de un bloque de la grilla — un
// horario está libre solo si el intervalo completo [t, t+duración) no se
// cruza con ninguna reserva existente DE ESE PROFESIONAL. `extraTimes` son
// horas puntuales agregadas a mano (ej. una sobrehora pasado el cierre) que
// se evalúan con las mismas reglas de disponibilidad que el resto.
function buildSlots(
  date: string,
  durationMinutes: number,
  isBlockedDay: boolean,
  isBlockedTime: (time: string) => boolean,
  taken: { start: number; end: number }[],
  minLeadMinutes: number,
  hoursOverride: DayHoursOverride[] | null,
  extraTimes: string[] = []
): { time: string; available: boolean }[] {
  if (isBlockedDay) return [];
  const hours = hoursForDate(date, hoursOverride);

  // La grilla de horarios de inicio sigue usando slotMinutes (mantiene la UX
  // de horas "redondas"); lo que cambia es cuánto ocupa cada reserva.
  const gridMinutes = clientConfig.booking?.slotMinutes ?? 60;
  // Siempre se calcula (incluso en 0): nunca se ofrece un horario que ya pasó
  // hoy, y con un mínimo configurado además exige ese margen desde ahora.
  const min = nowPlusMinutes(minLeadMinutes);
  const slots: { time: string; available: boolean }[] = [];
  const seen = new Set<string>();

  if (hours) {
    const [oh, om] = hours.open.split(":").map(Number);
    const [ch, cm] = hours.close.split(":").map(Number);
    for (let t = oh * 60 + om; t + durationMinutes <= ch * 60 + cm; t += gridMinutes) {
      const time = `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
      const end = t + durationMinutes;
      const overlaps = taken.some((iv) => t < iv.end && iv.start < end);
      const tooSoon = date < min.date || (date === min.date && time < min.time);
      slots.push({ time, available: !overlaps && !tooSoon && !isBlockedTime(time) });
      seen.add(time);
    }
  }

  // Sin horario ese día (feriado/domingo) igual se pueden ofrecer horas
  // extra puntuales — por eso este bloque corre aunque `hours` sea null.
  for (const time of extraTimes) {
    if (seen.has(time)) continue;
    const t = toMinutes(time);
    const end = t + durationMinutes;
    const overlaps = taken.some((iv) => t < iv.end && iv.start < end);
    const tooSoon = date < min.date || (date === min.date && time < min.time);
    slots.push({ time, available: !overlaps && !tooSoon && !isBlockedTime(time) });
    seen.add(time);
  }

  return slots.sort((a, b) => (a.time < b.time ? -1 : a.time > b.time ? 1 : 0));
}

// Trae reservas y bloqueos del día UNA sola vez (el set es chico — un día de
// un negocio) y los deja indexados por profesional, para no golpear la base
// una vez por candidato al armar la grilla de "cualquiera disponible".
async function dayState(date: string): Promise<{
  takenByProf: Map<string, { start: number; end: number }[]>;
  blocked: Set<string>;
  extra: Set<string>;
}> {
  return withDb(
    async () => {
      const sql = db();
      const [rows, blockedRows, extraRows] = await Promise.all([
        sql`SELECT time, duration_minutes, professional_id FROM bookings WHERE date = ${date} AND status <> 'cancelada'`,
        sql`SELECT key FROM blocked_slots WHERE key LIKE ${date + "%"}`,
        sql`SELECT key FROM extra_slots WHERE key LIKE ${date + "%"}`,
      ]);
      const takenByProf = new Map<string, { start: number; end: number }[]>();
      for (const r of rows) {
        const profId = String(r.professional_id ?? SHARED_PROFESSIONAL_ID);
        const start = toMinutes(String(r.time));
        const list = takenByProf.get(profId) ?? [];
        list.push({ start, end: start + Number(r.duration_minutes ?? 60) });
        takenByProf.set(profId, list);
      }
      return {
        takenByProf,
        blocked: new Set(blockedRows.map((r) => String(r.key))),
        extra: new Set(extraRows.map((r) => String(r.key))),
      };
    },
    () => {
      const s = store();
      const takenByProf = new Map<string, { start: number; end: number }[]>();
      for (const b of s.bookings) {
        if (b.date !== date || b.status === "cancelada") continue;
        const start = toMinutes(b.time);
        const list = takenByProf.get(b.professionalId) ?? [];
        list.push({ start, end: start + b.durationMinutes });
        takenByProf.set(b.professionalId, list);
      }
      return {
        takenByProf,
        blocked: new Set(s.blocked.filter((k) => k.startsWith(date))),
        extra: new Set(s.extraSlots.filter((k) => k.startsWith(date))),
      };
    }
  );
}

// `service` es opcional para no romper llamadas existentes (ej. el resumen de
// disponibilidad del chat antes de saber qué servicio quiere el cliente): sin
// él, usa la duración global y considera a todos los profesionales.
//
// `professionalId`: un id específico escopa la grilla a ESE profesional; sin
// él (o "any"), la hora sale disponible si AL MENOS UN profesional elegible
// para el servicio está libre — "cualquiera disponible" del formulario.
//
// `branchId` (requiere modules.multiBranch): además de filtrar los
// profesionales elegibles a esa sucursal, usa SU horario guardado (si nunca
// se configuró uno para esa sucursal, cae al horario "de fábrica" del
// config — igual que el flujo de una sola ubicación).
export async function slotsForDate(
  date: string,
  service?: string,
  professionalId?: string,
  branchId?: string
): Promise<{ time: string; available: boolean }[]> {
  // "any" = "sin sucursal elegida todavía" (mismo sentinel que professionalId
  // más abajo) — nunca debe resolver a una key de horario que no existe.
  const normalizedBranch = branchId && branchId !== "any" ? branchId : undefined;
  const durationMinutes = service ? await durationFor(service) : clientConfig.booking?.slotMinutes ?? 60;
  const [minLeadMinutes, hoursOverride, { takenByProf, blocked, extra }] = await Promise.all([
    getMinLeadMinutes(),
    getHoursOverride(normalizedBranch),
    dayState(date),
  ]);

  const targetIds =
    professionalId && professionalId !== "any"
      ? [professionalId]
      : (await eligibleProfessionals(service, normalizedBranch)).map((p) => p.id);

  const perProfessional = targetIds.map((id) =>
    buildSlots(
      date,
      durationMinutes,
      dayBlocked(date, id, blocked),
      (t) => timeBlocked(date, t, id, blocked),
      takenByProf.get(id) ?? [],
      minLeadMinutes,
      hoursOverride,
      extraTimesFor(date, id, extra)
    )
  );

  if (perProfessional.length <= 1) return perProfessional[0] ?? [];
  // Unión: un horario está disponible si lo está para cualquiera de los ids.
  // La grilla (horas de la lista) es idéntica entre profesionales — depende
  // solo de contact.hours/duración, no de reservas — así que alinean por índice.
  return perProfessional[0].map((slot, i) => ({
    time: slot.time,
    available: perProfessional.some((p) => p[i]?.available),
  }));
}

// Suma de minutos ya reservados ese día (todos los servicios, sin contar
// canceladas) — base del tope diario.
async function minutesBookedOn(date: string): Promise<number> {
  return withDb(
    async () => {
      const sql = db();
      const rows = await sql`
        SELECT COALESCE(SUM(duration_minutes), 0) AS total FROM bookings
        WHERE date = ${date} AND status <> 'cancelada'
      `;
      return Number(rows[0]?.total ?? 0);
    },
    () =>
      store()
        .bookings.filter((b) => b.date === date && b.status !== "cancelada")
        .reduce((sum, b) => sum + b.durationMinutes, 0)
  );
}

// Sin tope configurado, siempre "pendiente" (comportamiento de antes). Con
// tope, una reserva que lo supere no se autoconfirma: queda a la espera de que
// el dueño la autorice desde el panel.
async function decideStatus(date: string, durationMinutes: number): Promise<Booking["status"]> {
  const cap = await effectiveMaxDailyMinutes();
  if (!cap) return "pendiente";
  const already = await minutesBookedOn(date);
  return already + durationMinutes > cap ? "pendiente_autorizacion" : "pendiente";
}

export interface CreateBookingInput {
  service: string;
  date: string;
  time: string;
  name: string;
  phone: string;
  // Sin definir o "any": el sistema asigna a quien esté libre a esa hora
  // (el candidato con menos reservas ese día primero, para repartir parejo).
  // Con un id específico, reserva solo con ESE profesional.
  professionalId?: string;
  // Sucursal elegida (requiere modules.multiBranch) — sin definir, cae en
  // SHARED_BRANCH_ID (una sola ubicación, comportamiento de siempre).
  branchId?: string;
}

async function insertBooking(booking: Booking): Promise<"ok" | "taken" | "db-error"> {
  if (!hasDb()) {
    store().bookings.push(booking);
    await upsertClientFromBooking(booking.phone, booking.name);
    return "ok";
  }
  try {
    await ensureSchemaThen(async () => {
      const sql = db();
      await sql`
        INSERT INTO bookings (id, service, date, time, name, phone, status, duration_minutes, professional_id, branch_id, created_at)
        VALUES (${booking.id}, ${booking.service}, ${booking.date}, ${booking.time},
                ${booking.name}, ${booking.phone}, ${booking.status}, ${booking.durationMinutes},
                ${booking.professionalId}, ${booking.branchId}, ${booking.createdAt})
      `;
    });
    // Nunca debe tumbar la reserva ya guardada — si la ficha falla, la reserva
    // igual quedó registrada; se reintenta sola en la próxima reserva de este teléfono.
    await upsertClientFromBooking(booking.phone, booking.name).catch((e) =>
      console.error("[booking-store] upsertClientFromBooking:", e)
    );
    return "ok";
  } catch (error) {
    // El índice único (date, time, professional_id) es la última defensa
    // contra dos personas reservando la misma hora con el mismo profesional.
    if (String(error).includes("bookings_slot_unico")) return "taken";
    console.error("[booking-store] createBooking:", error);
    return "db-error";
  }
}

export async function createBooking(data: CreateBookingInput): Promise<Booking | { error: string }> {
  const durationMinutes = await durationFor(data.service);
  const branchId = data.branchId && data.branchId !== "any" ? data.branchId : SHARED_BRANCH_ID;
  const requestedId = data.professionalId && data.professionalId !== "any" ? data.professionalId : null;
  const candidates = requestedId
    ? [requestedId]
    : (await eligibleProfessionals(data.service, branchId)).map((p) => p.id);
  if (candidates.length === 0) return { error: "Nadie atiende ese servicio todavía." };

  // Menos reservas ese día primero, para repartir el trabajo parejo cuando el
  // cliente elige "cualquiera disponible". Con un profesional pedido a mano,
  // esto no cambia nada (candidates ya tiene un solo elemento).
  const { takenByProf } = await dayState(data.date);
  const ordered = [...candidates].sort(
    (a, b) => (takenByProf.get(a)?.length ?? 0) - (takenByProf.get(b)?.length ?? 0)
  );

  const status = await decideStatus(data.date, durationMinutes);
  let lastError = "Esa hora ya está tomada — elige otra.";

  for (const professionalId of ordered) {
    const slot = (await slotsForDate(data.date, data.service, professionalId, branchId)).find((x) => x.time === data.time);
    if (!slot) return { error: "Ese día no hay atención." };
    if (!slot.available) continue;

    const booking: Booking = {
      service: data.service,
      date: data.date,
      time: data.time,
      name: data.name,
      phone: data.phone,
      id: Math.random().toString(36).slice(2, 8).toUpperCase(),
      status,
      durationMinutes,
      professionalId,
      branchId,
      createdAt: new Date().toISOString(),
    };
    const result = await insertBooking(booking);
    if (result === "ok") return booking;
    if (result === "db-error") return { error: "No pudimos registrar la reserva. Intenta de nuevo en unos minutos." };
    // "taken": alguien tomó esa hora con este profesional justo ahora — si
    // pidieron uno específico no hay más candidatos; si era "cualquiera",
    // sigue probando con el resto.
    lastError = "Esa hora acaba de tomarla otra persona — elige otra.";
  }
  return { error: lastError };
}

export async function listBookings(): Promise<Booking[]> {
  return withDb(
    async () => {
      const sql = db();
      const rows = await sql`SELECT * FROM bookings ORDER BY date, time`;
      return rows.map((r) => rowToBooking(r as Record<string, unknown>));
    },
    () => [...store().bookings].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
  );
}

export async function setBookingStatus(id: string, status: Booking["status"]): Promise<boolean> {
  return withDb(
    async () => {
      const sql = db();
      const rows = await sql`UPDATE bookings SET status = ${status} WHERE id = ${id} RETURNING id`;
      return rows.length > 0;
    },
    () => {
      const b = store().bookings.find((x) => x.id === id);
      if (!b) return false;
      b.status = status;
      return true;
    }
  );
}

export async function getBooking(id: string): Promise<Booking | undefined> {
  return withDb(
    async () => {
      const sql = db();
      const rows = await sql`SELECT * FROM bookings WHERE id = ${id} LIMIT 1`;
      return rows[0] ? rowToBooking(rows[0] as Record<string, unknown>) : undefined;
    },
    () => store().bookings.find((x) => x.id === id)
  );
}

// Abono aprobado por Webpay: registra el pago y confirma la reserva de una vez.
export async function setBookingPaid(
  id: string,
  payment: { amount: number; authorizationCode?: string; cardLast4?: string }
): Promise<boolean> {
  return withDb(
    async () => {
      const sql = db();
      const rows = await sql`
        UPDATE bookings SET payment = ${jsonb(payment)}, status = 'confirmada'
        WHERE id = ${id} RETURNING id
      `;
      return rows.length > 0;
    },
    () => {
      const b = store().bookings.find((x) => x.id === id);
      if (!b) return false;
      b.payment = payment;
      b.status = "confirmada";
      return true;
    }
  );
}

export async function listBlocked(): Promise<string[]> {
  return withDb(
    async () => {
      const sql = db();
      const rows = await sql`SELECT key FROM blocked_slots ORDER BY key`;
      return rows.map((r) => String(r.key));
    },
    () => [...store().blocked].sort()
  );
}

export async function listExtraSlots(): Promise<string[]> {
  return withDb(
    async () => {
      const sql = db();
      const rows = await sql`SELECT key FROM extra_slots ORDER BY key`;
      return rows.map((r) => String(r.key));
    },
    () => [...store().extraSlots].sort()
  );
}

export async function getNotify(): Promise<{ email?: string; whatsapp?: string }> {
  return withDb(
    async () => {
      const sql = db();
      const rows = await sql`SELECT value FROM settings WHERE key = 'notify' LIMIT 1`;
      return (rows[0]?.value as { email?: string; whatsapp?: string }) ?? {};
    },
    () => ({ ...store().notify })
  );
}

export async function setNotify(data: { email?: string; whatsapp?: string }): Promise<void> {
  await withDb(
    async () => {
      const current = await getNotify();
      const next = { ...current };
      if (data.email !== undefined) next.email = data.email || undefined;
      if (data.whatsapp !== undefined) next.whatsapp = data.whatsapp || undefined;
      const sql = db();
      await sql`
        INSERT INTO settings (key, value) VALUES ('notify', ${jsonb(next)})
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
      `;
    },
    () => {
      const n = store().notify;
      if (data.email !== undefined) n.email = data.email || undefined;
      if (data.whatsapp !== undefined) n.whatsapp = data.whatsapp || undefined;
    }
  );
}

// Tope diario de avisos automáticos. Mantiene el envío dentro de la capa
// gratuita de Resend (100/día) aunque un prospecto pruebe la demo sin parar:
// pasado el tope la reserva se crea igual, solo se omite el aviso.
export async function consumeNotifyQuota(maxPerDay = 20): Promise<boolean> {
  const today = new Date().toISOString().slice(0, 10);
  return withDb(
    async () => {
      const sql = db();
      // Un solo upsert atómico: el WHERE hace que la base NO actualice cuando
      // el cupo del día ya se agotó, y entonces RETURNING no devuelve filas.
      const rows = await sql`
        INSERT INTO settings (key, value) VALUES ('notify_quota', ${jsonb({ date: today, sent: 1 })})
        ON CONFLICT (key) DO UPDATE SET value =
          CASE
            WHEN settings.value->>'date' <> ${today} THEN ${jsonb({ date: today, sent: 1 })}
            ELSE jsonb_build_object('date', ${today}::text, 'sent', (settings.value->>'sent')::int + 1)
          END
        WHERE settings.value->>'date' <> ${today} OR (settings.value->>'sent')::int < ${maxPerDay}
        RETURNING value
      `;
      return rows.length > 0;
    },
    () => {
      const s = store();
      if (!s.notifyQuota || s.notifyQuota.date !== today) s.notifyQuota = { date: today, sent: 0 };
      if (s.notifyQuota.sent >= maxPerDay) return false;
      s.notifyQuota.sent++;
      return true;
    }
  );
}

export async function toggleBlocked(key: string): Promise<{ blocked: boolean }> {
  return withDb(
    async () => {
      const sql = db();
      const deleted = await sql`DELETE FROM blocked_slots WHERE key = ${key} RETURNING key`;
      if (deleted.length > 0) return { blocked: false };
      await sql`INSERT INTO blocked_slots (key) VALUES (${key}) ON CONFLICT DO NOTHING`;
      return { blocked: true };
    },
    () => {
      const s = store();
      const i = s.blocked.indexOf(key);
      if (i >= 0) s.blocked.splice(i, 1);
      else s.blocked.push(key);
      return { blocked: i < 0 };
    }
  );
}

// Espejo de toggleBlocked: la key es "YYYY-MM-DD HH:mm" (opcional "|profId")
// de una hora que se ofrece EXTRA más allá del horario normal — típicamente
// una "sobrehora" pasado el cierre para acomodar a una clienta puntual.
export async function toggleExtraSlot(key: string): Promise<{ added: boolean }> {
  return withDb(
    async () => {
      const sql = db();
      const deleted = await sql`DELETE FROM extra_slots WHERE key = ${key} RETURNING key`;
      if (deleted.length > 0) return { added: false };
      await sql`INSERT INTO extra_slots (key) VALUES (${key}) ON CONFLICT DO NOTHING`;
      return { added: true };
    },
    () => {
      const s = store();
      const i = s.extraSlots.indexOf(key);
      if (i >= 0) s.extraSlots.splice(i, 1);
      else s.extraSlots.push(key);
      return { added: i < 0 };
    }
  );
}
