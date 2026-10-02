"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BarChart3, CalendarCheck, Users, Wallet, Settings, type LucideIcon } from "lucide-react";
import type { Booking, Client, Odontogram, Periodontogram, Budget, BudgetItem, Payment, Expense, InventoryItem, Branch } from "@/lib/booking-store";
// FDI_TEETH/ToothCondition/PeriodontalMeasurement vienen de lib/dental.ts
// (sin dependencias de servidor) — importarlos de lib/booking-store.ts
// arrastraría postgres al bundle del cliente y revienta el build. Ver la
// nota en ese archivo.
import { FDI_TEETH, type ToothCondition, type PeriodontalMeasurement } from "@/lib/dental";
import type { Vocabulary } from "@/lib/vocabulary";
import { buildBookingClientWaLink } from "@/lib/whatsapp";
import { buildGoogleCalendarUrl } from "@/lib/calendar";

const TOOTH_CONDITIONS: ToothCondition[] = [
  "sano",
  "caries",
  "obturado",
  "corona",
  "endodoncia",
  "implante",
  "ausente",
  "extraccion_indicada",
];
const TOOTH_LABEL: Record<ToothCondition, string> = {
  sano: "Sano",
  caries: "Caries",
  obturado: "Obturado",
  corona: "Corona",
  endodoncia: "Endodoncia",
  implante: "Implante",
  ausente: "Ausente",
  extraccion_indicada: "Extracción indicada",
};
const TOOTH_COLOR: Record<ToothCondition, string> = {
  sano: "bg-background text-foreground/60 border-foreground/20",
  caries: "bg-red-500/20 text-red-700 border-red-500/40",
  obturado: "bg-sky-500/20 text-sky-700 border-sky-500/40",
  corona: "bg-amber-500/20 text-amber-800 border-amber-500/40",
  endodoncia: "bg-purple-500/20 text-purple-700 border-purple-500/40",
  implante: "bg-emerald-500/20 text-emerald-700 border-emerald-500/40",
  ausente: "bg-foreground/10 text-foreground/30 border-foreground/20",
  extraccion_indicada: "bg-orange-500/20 text-orange-700 border-orange-500/40",
};
// Silueta genérica de diente (corona + dos raíces) — un solo path reutilizado
// en los 32 dientes del odontograma. fill="currentColor" hereda el color de
// texto del botón que lo envuelve, así que reutiliza TOOTH_COLOR tal cual sin
// duplicar la paleta.
function ToothIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12 2.5c-3.9 0-6.9 2.4-6.9 5.9 0 1.9.5 3.3.95 5.1.05.2.1.4.15.6.45 1.9.75 3.8 1.1 5.5.28 1.35 1.05 1.9 1.8 1.9.85 0 1.4-.65 1.6-1.85.25-1.45.35-3.4 1.3-3.4s1.05 1.95 1.3 3.4c.2 1.2.75 1.85 1.6 1.85.75 0 1.52-.55 1.8-1.9.35-1.7.65-3.6 1.1-5.5.05-.2.1-.4.15-.6.45-1.8.95-3.2.95-5.1 0-3.5-3-5.9-6.9-5.9Z" />
    </svg>
  );
}

// Periodontograma: color por la peor profundidad de sondaje del diente
// (estándar clínico simplificado — sano ≤3mm, riesgo 4-5mm, avanzado ≥6mm).
function perioSeverityColor(m: PeriodontalMeasurement | undefined): string {
  if (!m) return "bg-background text-foreground/40 border-foreground/20";
  const maxDepth = Math.max(...m.vestibular, ...m.lingual);
  if (maxDepth >= 6) return "bg-red-500/20 text-red-700 border-red-500/40";
  if (maxDepth >= 4) return "bg-amber-500/20 text-amber-800 border-amber-500/40";
  return "bg-emerald-500/15 text-emerald-700 border-emerald-500/30";
}
function hasBleeding(m: PeriodontalMeasurement | undefined): boolean {
  return !!m && (m.bleedingVestibular.some(Boolean) || m.bleedingLingual.some(Boolean));
}
function defaultPerioMeasurement(): PeriodontalMeasurement {
  return { vestibular: [0, 0, 0], lingual: [0, 0, 0], bleedingVestibular: [false, false, false], bleedingLingual: [false, false, false], mobility: 0 };
}

const PERIO_SITE_LABELS = ["Mesial", "Medio", "Distal"] as const;

// Panel de edición de un diente del periodontograma — 6 profundidades de
// sondaje (mm) + 6 sangrados + movilidad. Se guarda solo (sin botón aparte,
// igual que el odontograma): los toggles de sangrado y la movilidad guardan
// al tiro; las profundidades guardan al salir del campo (onBlur) para no
// mandar una request por cada tecla mientras se escribe el número.
function PerioToothPanel({
  tooth,
  measurement,
  saving,
  onChange,
  onClose,
}: {
  tooth: string;
  measurement: PeriodontalMeasurement | undefined;
  saving: boolean;
  onChange: (data: PeriodontalMeasurement) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<PeriodontalMeasurement>(measurement ?? defaultPerioMeasurement());
  // Solo resincroniza al cambiar de diente — si resincronizara con cada
  // `measurement` (que cambia tras cada guardado) el cursor saltaría mientras
  // se escribe en los inputs de profundidad.
  useEffect(() => {
    setDraft(measurement ?? defaultPerioMeasurement());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tooth]);

  function updateDepth(side: "vestibular" | "lingual", idx: number, value: number) {
    setDraft((prev) => ({ ...prev, [side]: prev[side].map((v, i) => (i === idx ? value : v)) as [number, number, number] }));
  }
  function toggleBleeding(side: "bleedingVestibular" | "bleedingLingual", idx: number) {
    setDraft((prev) => {
      const next = { ...prev, [side]: prev[side].map((v, i) => (i === idx ? !v : v)) as [boolean, boolean, boolean] };
      onChange(next);
      return next;
    });
  }
  function setMobility(m: 0 | 1 | 2 | 3) {
    setDraft((prev) => {
      const next = { ...prev, mobility: m };
      onChange(next);
      return next;
    });
  }

  return (
    <div className="mt-3 rounded-xl border border-foreground/15 bg-background p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-bold text-foreground">
          Diente {tooth}
          {saving && <span className="ml-2 font-normal text-foreground/40">guardando…</span>}
        </p>
        <button type="button" onClick={onClose} className="text-xs text-foreground/50 hover:text-foreground">
          Cerrar ✕
        </button>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {(["vestibular", "lingual"] as const).map((side) => {
          const bleedKey = side === "vestibular" ? "bleedingVestibular" : "bleedingLingual";
          return (
            <div key={side}>
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-foreground/50">
                {side === "vestibular" ? "Vestibular" : "Palatino / Lingual"}
              </p>
              <div className="flex gap-2">
                {PERIO_SITE_LABELS.map((siteLabel, idx) => (
                  <div key={siteLabel} className="flex flex-1 flex-col items-center gap-1">
                    <label className="text-[9px] text-foreground/40">{siteLabel}</label>
                    <input
                      type="number"
                      min={0}
                      max={20}
                      value={draft[side][idx]}
                      onChange={(e) => updateDepth(side, idx, Number(e.target.value) || 0)}
                      onBlur={() => onChange(draft)}
                      className="w-full rounded-lg border border-foreground/20 bg-background px-1 py-1 text-center text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => toggleBleeding(bleedKey, idx)}
                      title="Sangrado al sondaje"
                      aria-pressed={draft[bleedKey][idx]}
                      className={`h-4 w-4 rounded-full border ${draft[bleedKey][idx] ? "border-red-600 bg-red-600" : "border-foreground/25 bg-background"}`}
                    />
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex items-center gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground/50">Movilidad</p>
        {([0, 1, 2, 3] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMobility(m)}
            className={`h-6 w-6 rounded-full border text-[11px] font-bold ${
              draft.mobility === m ? "border-primary bg-primary text-white" : "border-foreground/20 text-foreground/60"
            }`}
          >
            {m}
          </button>
        ))}
      </div>
    </div>
  );
}

const BUDGET_STATUS_LABEL: Record<Budget["status"], string> = { pendiente: "Pendiente", aceptado: "Aceptado", rechazado: "Rechazado" };
const BUDGET_STATUS_STYLE: Record<Budget["status"], string> = {
  pendiente: "bg-amber-500/15 text-amber-600 border-amber-500/40",
  aceptado: "bg-emerald-500/15 text-emerald-600 border-emerald-500/40",
  rechazado: "bg-foreground/10 text-foreground/50 border-foreground/20",
};
const clp = (n: number) => "$" + n.toLocaleString("es-CL");
const priceFromMap = (prices: Record<string, string>, service: string) => Number((prices[service] ?? "").replace(/\D/g, "")) || 0;

// Informes de gestión: export CSV generado 100% en el navegador desde datos
// que el panel ya tiene cargados — sin endpoint nuevo. `﻿` al inicio es
// el BOM que hace que Excel abra los acentos bien en vez de mojibake.
function downloadCSV(filename: string, headers: string[], rows: (string | number)[][]) {
  const escape = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const csv = [headers, ...rows].map((r) => r.map(escape).join(",")).join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
const PAYMENT_METHODS: Payment["method"][] = ["efectivo", "tarjeta", "transferencia", "otro"];
const PAYMENT_METHOD_LABEL: Record<Payment["method"], string> = {
  efectivo: "Efectivo",
  tarjeta: "Tarjeta",
  transferencia: "Transferencia",
  otro: "Otro",
};
// Categorías sugeridas, texto libre igual (cada negocio tiene las suyas) —
// esto solo llena el <select> con opciones típicas para no partir de cero.
const EXPENSE_CATEGORIES = ["Insumos", "Arriendo", "Sueldos", "Servicios", "Marketing", "Otro"];

const STATUS_STYLE: Record<Booking["status"], string> = {
  pendiente: "bg-amber-500/15 text-amber-600 border-amber-500/40",
  pendiente_autorizacion: "bg-red-500/15 text-red-600 border-red-500/40",
  confirmada: "bg-emerald-500/15 text-emerald-600 border-emerald-500/40",
  cancelada: "bg-foreground/10 text-foreground/50 border-foreground/20",
};

const STATUS_LABEL: Record<Booking["status"], string> = {
  pendiente: "pendiente",
  pendiente_autorizacion: "requiere autorización",
  confirmada: "confirmada",
  cancelada: "cancelada",
};

// Panel del dueño: revisar reservas, confirmarlas (tras recibir el abono),
// cancelarlas y bloquear días u horas en que no puede recibir agenda.
export function AdminAgenda({
  adminKey,
  notifyEmail,
  businessName,
  services,
  dentalRecords,
  expenses: expensesEnabled,
  multiBranch,
  vocabulary,
}: {
  // Ausente cuando el dueño entró con Google (la sesión va por cookie, no por
  // clave). Presente solo si el sitio sigue usando ?clave= — ver lib/auth.ts.
  adminKey?: string;
  notifyEmail: string | null;
  businessName: string;
  services: { title: string; durationMinutes?: number; price?: string }[];
  // Odontograma y presupuestos dentro de la ficha de cliente — solo clínicas
  // dentales (clientConfig.modules.dentalRecords). Default false: cualquier
  // otro rubro que use esta Agenda (barbería, salón, estudio jurídico) nunca
  // ve estas secciones.
  dentalRecords?: boolean;
  // Gastos e inventario — transversal a cualquier rubro (clientConfig.modules.expenses),
  // nunca atado a dentalRecords. Sección propia, no cuelga de ninguna ficha.
  expenses?: boolean;
  // Multicentro (clientConfig.modules.multiBranch) — "puede ser 1 o +": con 0
  // o 1 sucursal configurada, el panel se ve idéntico a un negocio de una
  // sola ubicación (ver lib/booking-store.ts#SHARED_BRANCH_ID).
  multiBranch?: boolean;
  // Cómo le llama ESTE rubro a "profesional"/"cliente"/"reserva"/"insumo" —
  // ver lib/vocabulary.ts. Siempre viene resuelto (con defaults aplicados)
  // desde app/agenda/admin/page.tsx.
  vocabulary: Vocabulary;
}) {
  const [role, setRole] = useState<"admin" | "staff" | null>(null);
  const [professionals, setProfessionals] = useState<{ id: string; name: string; commissionPercent?: number }[]>([]);
  const [myProfessionalId, setMyProfessionalId] = useState<string | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [clientSearch, setClientSearch] = useState("");
  const [expandedClient, setExpandedClient] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});
  const [savingNotesFor, setSavingNotesFor] = useState<string | null>(null);
  const [odontograms, setOdontograms] = useState<Odontogram[]>([]);
  // "phone:tooth" del diente cuyo popover de condición está abierto — un solo
  // valor global (no por ficha) porque solo una ficha está expandida a la vez.
  const [openToothPopover, setOpenToothPopover] = useState<string | null>(null);
  const [periodontograms, setPeriodontograms] = useState<Periodontogram[]>([]);
  // "phone:tooth" del diente cuyo panel de periodontograma está abierto.
  const [openPerioTooth, setOpenPerioTooth] = useState<string | null>(null);
  const [savingPerioTooth, setSavingPerioTooth] = useState<string | null>(null);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [savingTooth, setSavingTooth] = useState<string | null>(null);
  const [budgetDraft, setBudgetDraft] = useState<Record<string, BudgetItem[]>>({});
  const [savingBudgetFor, setSavingBudgetFor] = useState<string | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [paymentDraft, setPaymentDraft] = useState<Record<string, { amount: string; method: Payment["method"]; note: string }>>({});
  const [savingPaymentFor, setSavingPaymentFor] = useState<string | null>(null);
  const [expensesList, setExpensesList] = useState<Expense[]>([]);
  const [expenseDraft, setExpenseDraft] = useState({ date: "", category: EXPENSE_CATEGORIES[0], description: "", amount: "" });
  const [savingExpense, setSavingExpense] = useState(false);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [inventoryDraft, setInventoryDraft] = useState({ name: "", unit: "unidad", quantity: "", minStock: "" });
  const [savingInventoryItem, setSavingInventoryItem] = useState(false);
  const [stockAdjustDraft, setStockAdjustDraft] = useState<Record<string, string>>({});
  const [statsRange, setStatsRange] = useState<"hoy" | "semana" | "mes">("semana");
  // Pestaña activa del dashboard — reemplaza la página única de siempre. Cada
  // sección existente se queda en su lugar en el código, solo se le agrega
  // "&& activeTab === '...'" a su condición de render (o, si no tenía
  // ninguna, se le agrega una nueva) — nada de la lógica de datos cambia.
  const [activeTab, setActiveTab] = useState<"resumen" | "reservas" | "clientes" | "finanzas" | "config">("resumen");
  const [blocked, setBlocked] = useState<string[]>([]);
  const [blockDate, setBlockDate] = useState("");
  const [blockTime, setBlockTime] = useState("");
  const [blockProfessional, setBlockProfessional] = useState("");
  const [extraSlots, setExtraSlots] = useState<string[]>([]);
  const [extraDate, setExtraDate] = useState("");
  const [extraTime, setExtraTime] = useState("");
  const [extraProfessional, setExtraProfessional] = useState("");
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [waMode, setWaMode] = useState<"wame" | "api">("wame");
  const [testResult, setTestResult] = useState<string>("");
  const [calCopied, setCalCopied] = useState(false);
  const [durations, setDurations] = useState<Record<string, number>>({});
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [maxDailyMinutes, setMaxDailyMinutesState] = useState<string>("");
  const [minLeadMinutes, setMinLeadMinutesState] = useState(0);
  const [savingConfig, setSavingConfig] = useState(false);
  const [configSaved, setConfigSaved] = useState(false);
  const [professionalsForm, setProfessionalsForm] = useState<
    { id: string; name: string; email: string; services: string[]; commissionPercent: string; branchId: string }[]
  >([]);
  const [savingProfessionals, setSavingProfessionals] = useState(false);
  const [professionalsSaved, setProfessionalsSaved] = useState(false);
  // Sucursales (multiBranch). Con 0 o 1, branches.length <= 1 y toda esta UI
  // se comporta como si el módulo no existiera — "puede ser 1 o +".
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchesForm, setBranchesForm] = useState<{ id: string; name: string; address: string }[]>([]);
  const [savingBranches, setSavingBranches] = useState(false);
  const [branchesSaved, setBranchesSaved] = useState(false);
  // Horario por sucursal: hoursByBranchForm[""] es el horario "de siempre"
  // (una sola ubicación, key 'hours' del lado del servidor); con 2+
  // sucursales cada una vive bajo su propio id. activeHoursBranch elige cuál
  // se ve/edita en la sección "Horario de atención" — hoursForm/setHoursForm
  // quedan como bindings derivados para no tocar el resto del componente.
  const [hoursByBranchForm, setHoursByBranchForm] = useState<Record<string, { open: string; close: string; closed: boolean }[]>>({});
  const [activeHoursBranch, setActiveHoursBranch] = useState<string>("");
  const hoursForm = hoursByBranchForm[activeHoursBranch] ?? [];
  const setHoursForm = useCallback(
    (updater: ((prev: { open: string; close: string; closed: boolean }[]) => { open: string; close: string; closed: boolean }[]) | { open: string; close: string; closed: boolean }[]) => {
      setHoursByBranchForm((prev) => ({
        ...prev,
        [activeHoursBranch]: typeof updater === "function" ? updater(prev[activeHoursBranch] ?? []) : updater,
      }));
    },
    [activeHoursBranch]
  );
  const [savingHours, setSavingHours] = useState(false);
  const [hoursSaved, setHoursSaved] = useState(false);
  // Absoluta recién en el cliente para no diferir del HTML del servidor (hidratación).
  const [calendarUrl, setCalendarUrl] = useState(`/api/agenda/calendario?clave=${adminKey ?? ""}`);
  useEffect(() => {
    setCalendarUrl(`${window.location.origin}/api/agenda/calendario?clave=${adminKey ?? ""}`);
  }, [adminKey]);

  const refresh = useCallback(async () => {
    const d = await fetch("/api/agenda", { headers: adminKey ? { "x-agenda-key": adminKey } : {} }).then((r) =>
      r.json()
    );
    setRole(d.role === "staff" ? "staff" : "admin");
    setProfessionals(d.professionals ?? []);
    setMyProfessionalId(d.myProfessionalId ?? null);
    setBookings(d.bookings ?? []);
    setClients(d.clients ?? []);
    setOdontograms(d.odontograms ?? []);
    setPeriodontograms(d.periodontograms ?? []);
    setBudgets(d.budgets ?? []);
    setPayments(d.payments ?? []);
    setExpensesList(d.expenses ?? []);
    setInventory(d.inventory ?? []);
    setBlocked(d.blocked ?? []);
    setExtraSlots(d.extraSlots ?? []);
    if (d.notify) {
      setEmail(d.notify.email ?? "");
      setWhatsapp(d.notify.whatsapp ?? "");
      setWaMode(d.notify.whatsappMode === "api" ? "api" : "wame");
    }
    setDurations({ ...Object.fromEntries(services.map((s) => [s.title, s.durationMinutes ?? 60])), ...(d.serviceDurations ?? {}) });
    setPrices({ ...Object.fromEntries(services.map((s) => [s.title, s.price ?? ""])), ...(d.servicePrices ?? {}) });
    setMaxDailyMinutesState(d.maxDailyMinutes ? String(d.maxDailyMinutes) : "");
    if (typeof d.minLeadMinutes === "number") setMinLeadMinutesState(d.minLeadMinutes);
    if (d.professionalsFull) {
      setProfessionalsForm(
        d.professionalsFull.map(
          (p: { id: string; name: string; email?: string; services?: string[]; commissionPercent?: number; branchId?: string }) => ({
            id: p.id,
            name: p.name,
            email: p.email ?? "",
            services: p.services ?? [],
            commissionPercent: p.commissionPercent !== undefined ? String(p.commissionPercent) : "",
            branchId: p.branchId ?? "",
          })
        )
      );
    }
    const mapHours = (hours: { open?: string; close?: string; closed?: boolean }[]) =>
      hours.map((h) => ({ open: h.open ?? "09:00", close: h.close ?? "18:00", closed: h.closed ?? false }));
    if (d.hours) {
      const byBranch: Record<string, { open: string; close: string; closed: boolean }[]> = { "": mapHours(d.hours) };
      if (d.branches) {
        setBranches(d.branches);
        setBranchesForm(d.branches.map((b: Branch) => ({ id: b.id, name: b.name, address: b.address ?? "" })));
        for (const b of d.branches as Branch[]) {
          byBranch[b.id] = mapHours(d.hoursByBranch?.[b.id] ?? d.hours);
        }
        setActiveHoursBranch((prev) => (prev && byBranch[prev] ? prev : (d.branches[0]?.id ?? "")));
      } else {
        setBranches([]);
        setBranchesForm([]);
      }
      setHoursByBranchForm(byBranch);
    }
    setLoading(false);
  }, [adminKey, services]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function patch(body: object) {
    await fetch("/api/agenda", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...(adminKey ? { "x-agenda-key": adminKey } : {}) },
      body: JSON.stringify(body),
    });
    refresh();
  }

  async function saveServiceConfig() {
    setSavingConfig(true);
    setConfigSaved(false);
    await patch({
      action: "serviceConfig",
      durations,
      prices,
      maxDailyMinutes: maxDailyMinutes.trim() ? Number(maxDailyMinutes) : null,
      minLeadMinutes,
    });
    setSavingConfig(false);
    setConfigSaved(true);
    setTimeout(() => setConfigSaved(false), 2500);
  }

  // Slug simple para el id — estable mientras no se borre la fila, aunque se
  // le cambie el nombre después (así no se "pierden" sus reservas pasadas).
  function slugify(name: string, taken: Set<string>): string {
    const base =
      name
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // quita tildes tras NFD, igual que normalizeDay en booking-store.ts
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || "profesional";
    let slug = base;
    let i = 2;
    while (taken.has(slug)) slug = `${base}-${i++}`;
    return slug;
  }

  function addProfessional() {
    setProfessionalsForm((prev) => [...prev, { id: "", name: "", email: "", services: [], commissionPercent: "", branchId: "" }]);
  }
  function removeProfessional(index: number) {
    setProfessionalsForm((prev) => prev.filter((_, i) => i !== index));
  }

  async function saveProfessionals() {
    setSavingProfessionals(true);
    setProfessionalsSaved(false);
    const taken = new Set(professionalsForm.filter((p) => p.id).map((p) => p.id));
    const withIds = professionalsForm
      .filter((p) => p.name.trim())
      .map((p) => (p.id ? p : { ...p, id: slugify(p.name, taken) }));
    withIds.forEach((p) => taken.add(p.id));
    setProfessionalsForm(withIds);
    await patch({
      action: "setProfessionals",
      professionals: withIds.map((p) => ({
        id: p.id,
        name: p.name.trim(),
        email: p.email.trim(),
        services: p.services,
        commissionPercent: p.commissionPercent.trim() ? Number(p.commissionPercent) : undefined,
        branchId: p.branchId || undefined,
      })),
    });
    setSavingProfessionals(false);
    setProfessionalsSaved(true);
    setTimeout(() => setProfessionalsSaved(false), 2500);
  }

  function addBranch() {
    setBranchesForm((prev) => [...prev, { id: "", name: "", address: "" }]);
  }
  function removeBranch(index: number) {
    setBranchesForm((prev) => prev.filter((_, i) => i !== index));
  }

  async function saveBranches() {
    setSavingBranches(true);
    setBranchesSaved(false);
    const taken = new Set(branchesForm.filter((b) => b.id).map((b) => b.id));
    const withIds = branchesForm
      .filter((b) => b.name.trim())
      .map((b) => (b.id ? b : { ...b, id: slugify(b.name, taken) }));
    withIds.forEach((b) => taken.add(b.id));
    setBranchesForm(withIds);
    await patch({
      action: "setBranches",
      branches: withIds.map((b) => ({ id: b.id, name: b.name.trim(), address: b.address.trim() || undefined })),
    });
    setSavingBranches(false);
    setBranchesSaved(true);
    setTimeout(() => setBranchesSaved(false), 2500);
  }

  const WEEKDAY_LABELS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

  async function saveHours() {
    setSavingHours(true);
    setHoursSaved(false);
    await patch({
      action: "setHours",
      hours: hoursForm.map((h) => (h.closed ? { closed: true } : { open: h.open, close: h.close })),
      branchId: activeHoursBranch || undefined,
    });
    setSavingHours(false);
    setHoursSaved(true);
    setTimeout(() => setHoursSaved(false), 2500);
  }

  async function saveClientNotes(phone: string) {
    setSavingNotesFor(phone);
    await patch({ action: "clientNotes", phone, notes: notesDraft[phone] ?? "" });
    setSavingNotesFor(null);
  }

  // Odontograma: se guarda solo al elegir una condición, sin botón aparte —
  // igual que marcar un diente en la ficha de papel.
  async function saveTooth(phone: string, tooth: string, condition: ToothCondition) {
    setSavingTooth(`${phone}:${tooth}`);
    await patch({ action: "setTooth", phone, tooth, condition });
    setSavingTooth(null);
    setOpenToothPopover(null);
  }

  // Periodontograma: mismo patrón (guarda solo, un diente a la vez) — se
  // llama con el objeto completo del diente cada vez (los 13 campos viven
  // juntos en el panel de edición, no hay guardado parcial por campo).
  async function savePerioTooth(phone: string, tooth: string, data: PeriodontalMeasurement) {
    setSavingPerioTooth(`${phone}:${tooth}`);
    await patch({ action: "setPeriodontalTooth", phone, tooth, data });
    setSavingPerioTooth(null);
  }

  function emptyBudgetRow(): BudgetItem {
    return { description: "", price: 0 };
  }
  function addBudgetRow(phone: string) {
    setBudgetDraft((prev) => ({ ...prev, [phone]: [...(prev[phone] ?? []), emptyBudgetRow()] }));
  }
  function updateBudgetRow(phone: string, index: number, patchRow: Partial<BudgetItem>) {
    setBudgetDraft((prev) => ({
      ...prev,
      [phone]: (prev[phone] ?? []).map((row, i) => (i === index ? { ...row, ...patchRow } : row)),
    }));
  }
  function removeBudgetRow(phone: string, index: number) {
    setBudgetDraft((prev) => ({ ...prev, [phone]: (prev[phone] ?? []).filter((_, i) => i !== index) }));
  }
  async function submitBudget(phone: string) {
    const items = (budgetDraft[phone] ?? []).filter((r) => r.description.trim() && r.price > 0);
    if (items.length === 0) return;
    setSavingBudgetFor(phone);
    await patch({ action: "addBudget", phone, items });
    setBudgetDraft((prev) => ({ ...prev, [phone]: [] }));
    setSavingBudgetFor(null);
  }
  async function setBudgetStatus(id: string, status: Budget["status"]) {
    await patch({ action: "budgetStatus", id, status });
  }

  function paymentDraftFor(phone: string) {
    return paymentDraft[phone] ?? { amount: "", method: "efectivo" as Payment["method"], note: "" };
  }
  function updatePaymentDraft(phone: string, patchDraft: Partial<{ amount: string; method: Payment["method"]; note: string }>) {
    setPaymentDraft((prev) => ({ ...prev, [phone]: { ...paymentDraftFor(phone), ...patchDraft } }));
  }
  async function submitPayment(phone: string) {
    const draft = paymentDraftFor(phone);
    const amount = Number(draft.amount);
    if (!amount || amount <= 0) return;
    setSavingPaymentFor(phone);
    await patch({ action: "addPayment", phone, amount, method: draft.method, note: draft.note || undefined });
    setPaymentDraft((prev) => ({ ...prev, [phone]: { amount: "", method: "efectivo", note: "" } }));
    setSavingPaymentFor(null);
  }

  async function submitExpense() {
    const amount = Number(expenseDraft.amount);
    if (!expenseDraft.date || !expenseDraft.description.trim() || !amount || amount <= 0) return;
    setSavingExpense(true);
    await patch({ action: "addExpense", date: expenseDraft.date, category: expenseDraft.category, description: expenseDraft.description, amount });
    setExpenseDraft({ date: "", category: EXPENSE_CATEGORIES[0], description: "", amount: "" });
    setSavingExpense(false);
  }
  async function removeExpense(id: string) {
    await patch({ action: "deleteExpense", id });
  }

  async function submitInventoryItem() {
    const quantity = Number(inventoryDraft.quantity) || 0;
    if (!inventoryDraft.name.trim()) return;
    setSavingInventoryItem(true);
    await patch({
      action: "addInventoryItem",
      name: inventoryDraft.name,
      unit: inventoryDraft.unit,
      quantity,
      minStock: inventoryDraft.minStock ? Number(inventoryDraft.minStock) : undefined,
    });
    setInventoryDraft({ name: "", unit: "unidad", quantity: "", minStock: "" });
    setSavingInventoryItem(false);
  }
  async function adjustStock(id: string, delta: number) {
    await patch({ action: "adjustInventory", id, delta });
  }
  async function removeInventoryItem(id: string) {
    await patch({ action: "deleteInventoryItem", id });
  }

  const isAdmin = role === "admin";
  // Staff solo ve Resumen/Reservas — el resto de las pestañas son 100%
  // isAdmin-gated de todas formas, mostrárselas vacías sería el mismo
  // callejón sin salida que la página única de siempre.
  const TABS: { id: typeof activeTab; label: string; Icon: LucideIcon }[] = [
    { id: "resumen", label: "Resumen", Icon: BarChart3 },
    { id: "reservas", label: vocabulary.bookingPlural, Icon: CalendarCheck },
    ...(isAdmin ? [{ id: "clientes" as const, label: vocabulary.clientPlural, Icon: Users }] : []),
    ...(isAdmin && expensesEnabled ? [{ id: "finanzas" as const, label: "Finanzas", Icon: Wallet }] : []),
    ...(isAdmin ? [{ id: "config" as const, label: "Configuración", Icon: Settings }] : []),
  ];
  const professionalName = (id: string) => professionals.find((p) => p.id === id)?.name;
  const pending = bookings.filter((b) => b.status === "pendiente").length;
  const needsAuth = bookings.filter((b) => b.status === "pendiente_autorizacion").length;
  const demoBooking = bookings.find((b) => b.status === "pendiente" && b.phone.replace(/\D/g, "").length >= 8);
  const waDigits = whatsapp.replace(/\D/g, "");

  // Estadísticas: todo calculado en el navegador desde lo que ya llegó con
  // /api/agenda (reservas, precios, horario, profesionales) — sin endpoint
  // nuevo. Rango siempre termina HOY (no proyecta reservas futuras del rango
  // como "logradas" todavía). El staff ve solo lo suyo porque `bookings` ya
  // viene filtrado desde el servidor para ese rol.
  const stats = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const today = new Date(`${todayStr}T12:00:00`);
    let start = today;
    if (statsRange === "semana") {
      const dow = today.getDay(); // 0=domingo
      const diffToMonday = dow === 0 ? 6 : dow - 1;
      start = new Date(today);
      start.setDate(start.getDate() - diffToMonday);
    } else if (statsRange === "mes") {
      start = new Date(today.getFullYear(), today.getMonth(), 1);
    }
    const startStr = start.toISOString().slice(0, 10);

    const priceOf = (service: string) => priceFromMap(prices, service);
    const inRange = bookings.filter((b) => b.date >= startStr && b.date <= todayStr);
    const activas = inRange.filter((b) => b.status !== "cancelada");
    const canceladas = inRange.filter((b) => b.status === "cancelada");
    const ingresos = activas.reduce((sum, b) => sum + priceOf(b.service), 0);
    const tasaCancelacion = inRange.length > 0 ? Math.round((canceladas.length / inRange.length) * 100) : 0;

    // Ocupación = minutos reservados / minutos de atención disponibles en el
    // rango (horario configurado × profesionales activos, día por día).
    let minutosDisponibles = 0;
    for (const cursor = new Date(start); cursor <= today; cursor.setDate(cursor.getDate() + 1)) {
      const h = hoursForm[cursor.getDay()];
      if (h && !h.closed && h.open && h.close) {
        const [oh, om] = h.open.split(":").map(Number);
        const [ch, cm] = h.close.split(":").map(Number);
        minutosDisponibles += Math.max(0, ch * 60 + cm - (oh * 60 + om)) * Math.max(1, professionals.length);
      }
    }
    const minutosReservados = activas.reduce((sum, b) => sum + (b.durationMinutes || 0), 0);
    const ocupacion = minutosDisponibles > 0 ? Math.min(100, Math.round((minutosReservados / minutosDisponibles) * 100)) : 0;

    const porProfesional = new Map<string, { reservas: number; ingresos: number }>();
    for (const b of activas) {
      const cur = porProfesional.get(b.professionalId) ?? { reservas: 0, ingresos: 0 };
      cur.reservas += 1;
      cur.ingresos += priceOf(b.service);
      porProfesional.set(b.professionalId, cur);
    }
    const ranking = [...porProfesional.entries()]
      .map(([id, v]) => {
        const pct = professionals.find((p) => p.id === id)?.commissionPercent ?? 0;
        return { id, name: professionalName(id) ?? "Sin asignar", ...v, comision: Math.round(v.ingresos * (pct / 100)) };
      })
      .sort((a, b) => b.reservas - a.reservas);

    const porServicio = new Map<string, number>();
    for (const b of activas) porServicio.set(b.service, (porServicio.get(b.service) ?? 0) + 1);
    const serviciosTop = [...porServicio.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

    // Recurrencia: se mide contra TODO el historial (no solo el rango) — una
    // reserva del rango cuenta como "de cliente recurrente" si ese teléfono
    // ya había reservado antes también.
    const historialPorTelefono = new Map<string, number>();
    for (const b of bookings) {
      if (b.status === "cancelada") continue;
      const key = b.phone.replace(/\D/g, "");
      historialPorTelefono.set(key, (historialPorTelefono.get(key) ?? 0) + 1);
    }
    const recurrentes = activas.filter((b) => (historialPorTelefono.get(b.phone.replace(/\D/g, "")) ?? 0) > 1).length;
    const pctRecurrentes = activas.length > 0 ? Math.round((recurrentes / activas.length) * 100) : 0;

    return { totalReservas: activas.length, ingresos, tasaCancelacion, ocupacion, ranking, serviciosTop, pctRecurrentes, inRangeBookings: inRange, rangeLabel: statsRange };
  }, [bookings, prices, hoursForm, professionals, statsRange]);

  // Análisis de pacientes/clientes: frecuencia de visita de por vida (no
  // limitada al rango de Estadísticas) — sirve para detectar clientes
  // frecuentes y ofrecer algo después de X atenciones, transversal a
  // cualquier rubro que use la Agenda (no solo clínicas).
  const frequentClients = useMemo(() => {
    const byPhone = new Map<string, { visits: number; ingresos: number; lastDate: string }>();
    for (const b of bookings) {
      if (b.status === "cancelada") continue;
      const key = b.phone.replace(/\D/g, "");
      const cur = byPhone.get(key) ?? { visits: 0, ingresos: 0, lastDate: b.date };
      cur.visits += 1;
      cur.ingresos += priceFromMap(prices, b.service);
      if (b.date > cur.lastDate) cur.lastDate = b.date;
      byPhone.set(key, cur);
    }
    return [...byPhone.entries()]
      .map(([key, v]) => {
        const client = clients.find((c) => c.phone.replace(/\D/g, "") === key);
        return { phone: client?.phone ?? key, name: client?.name ?? key, ...v };
      })
      .filter((c) => c.visits >= 2)
      .sort((a, b) => b.visits - a.visits)
      .slice(0, 10);
  }, [bookings, clients, prices]);

  const downloadReservasCSV = useCallback(() => {
    downloadCSV(
      `reservas-${stats.rangeLabel}-${new Date().toISOString().slice(0, 10)}.csv`,
      ["Fecha", "Hora", "Servicio", "Cliente", "Teléfono", "Profesional", "Estado", "Precio"],
      stats.inRangeBookings.map((b) => [
        b.date,
        b.time,
        b.service,
        b.name,
        b.phone,
        professionalName(b.professionalId) ?? "",
        b.status,
        priceFromMap(prices, b.service),
      ])
    );
  }, [stats, prices, professionalName]);

  return (
    <div className="flex flex-col gap-10 pb-24 sm:pb-0">
      {role && (
        <span
          className={`w-fit rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wider ${
            isAdmin
              ? "border-primary/40 bg-primary/10 text-primary"
              : "border-sky-500/40 bg-sky-500/10 text-sky-600"
          }`}
        >
          {isAdmin ? "Acceso: administrador" : "Acceso: staff"}
        </span>
      )}

      {/* Nav de pestañas — mismo lenguaje visual "pill" que ya usan los
          switches de Estadísticas y Horario, solo que ahora arriba de todo.
          Escritorio: fila horizontal. Mobile: barra fija abajo (patrón de
          apps nativas — a diferencia del drawer del Header público, esto es
          una herramienta operativa que se revisa muchas veces por turno, no
          un menú que se abre una vez). */}
      <nav className="hidden flex-wrap gap-1.5 rounded-full border border-foreground/15 p-1 sm:flex sm:w-fit">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActiveTab(t.id)}
            className={`rounded-full px-4 py-2 text-xs font-bold uppercase tracking-wider transition-colors ${
              activeTab === t.id ? "bg-primary text-white" : "text-foreground/60 hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>
      <nav
        className="fixed inset-x-0 bottom-0 z-40 flex border-t border-foreground/10 bg-background/95 backdrop-blur sm:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActiveTab(t.id)}
            className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-bold uppercase tracking-wide ${
              activeTab === t.id ? "text-primary" : "text-foreground/50"
            }`}
          >
            <t.Icon className="h-5 w-5" />
            {t.label}
          </button>
        ))}
      </nav>

      {/* Estadísticas — primero lo que todos ven al entrar. El staff ve las
          mismas tarjetas pero sobre SUS reservas (ya vienen filtradas del
          servidor); el ranking por profesional es solo para admin, comparar
          a los demás no le corresponde al staff. */}
      {activeTab === "resumen" && (
      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-heading text-xl font-bold text-foreground">Estadísticas</h2>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex gap-1.5 rounded-full border border-foreground/15 p-1">
              {(["hoy", "semana", "mes"] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setStatsRange(r)}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider transition-colors ${
                    statsRange === r ? "bg-primary text-white" : "text-foreground/60 hover:text-foreground"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
            {isAdmin && (
              <button
                type="button"
                onClick={downloadReservasCSV}
                className="rounded-full border border-foreground/15 px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider text-foreground/70 transition-colors hover:border-primary/40 hover:text-primary"
                title="Exportar las reservas del rango seleccionado a un archivo CSV (Excel)"
              >
                Descargar CSV
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Reservas", value: String(stats.totalReservas) },
            { label: "Ingresos", value: `$${stats.ingresos.toLocaleString("es-CL")}` },
            { label: "Ocupación", value: `${stats.ocupacion}%` },
            { label: "Cancelación", value: `${stats.tasaCancelacion}%` },
          ].map((kpi) => (
            <div key={kpi.label} className="rounded-xl border border-foreground/15 bg-foreground/[0.03] p-4">
              <p className="m-0 text-2xl font-bold text-foreground">{kpi.value}</p>
              <p className="m-0 mt-1 text-xs font-semibold uppercase tracking-wider text-foreground/60">{kpi.label}</p>
            </div>
          ))}
        </div>

        {isAdmin && professionals.length > 1 && stats.ranking.length > 0 && (
          <div className="rounded-xl border border-foreground/15 p-4">
            <p className="m-0 mb-3 text-xs font-semibold uppercase tracking-wider text-foreground/60">Por profesional</p>
            <div className="flex flex-col gap-2">
              {stats.ranking.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-semibold text-foreground">{p.name}</span>
                  <span className="text-foreground/60">
                    {p.reservas} reserva{p.reservas === 1 ? "" : "s"} · ${p.ingresos.toLocaleString("es-CL")}
                    {expensesEnabled && p.comision > 0 && (
                      <span className="ml-2 font-semibold text-emerald-600">· comisión {clp(p.comision)}</span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {stats.serviciosTop.length > 0 && (
          <div className="rounded-xl border border-foreground/15 p-4">
            <p className="m-0 mb-3 text-xs font-semibold uppercase tracking-wider text-foreground/60">Servicios más pedidos</p>
            <div className="flex flex-col gap-2">
              {stats.serviciosTop.map(([service, count]) => (
                <div key={service} className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-semibold text-foreground">{service}</span>
                  <span className="text-foreground/60">{count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {stats.totalReservas > 0 && (
          <p className="m-0 text-sm text-foreground/60">
            <strong className="text-foreground">{stats.pctRecurrentes}%</strong> de estas reservas son de clientes que ya
            habían reservado antes.
          </p>
        )}
      </section>
      )}

      {/* Notificaciones — solo admin: define a dónde llegan los avisos de TODO
          el negocio, no algo que cada miembro del staff deba tocar. */}
      {isAdmin && activeTab === "config" && (
        <div className="rounded-xl border border-foreground/15 bg-foreground/[0.03] p-5 text-sm text-foreground/70">
          <p className="font-semibold text-foreground">🔔 Avisos de reserva nueva (gratis con wa.me)</p>
          <p className="mt-2 leading-relaxed">
            Cuando alguien agenda, te llega un <strong>correo</strong> con un enlace wa.me que abre WhatsApp con el
            resumen listo. No usa API de Meta ni módulos de pago — solo necesitas tu número abajo.
          </p>
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <label className="flex min-w-[220px] flex-1 flex-col gap-1 text-xs font-semibold uppercase tracking-wider text-foreground/60">
              Tu correo
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={notifyEmail ?? "tucorreo@gmail.com"}
                className="rounded-lg border border-foreground/20 bg-background px-3 py-2.5 text-sm normal-case tracking-normal text-foreground"
              />
            </label>
            <label className="flex min-w-[180px] flex-col gap-1 text-xs font-semibold uppercase tracking-wider text-foreground/60">
              Tu WhatsApp ({businessName})
              <input
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                placeholder="+56 9 …"
                className="rounded-lg border border-foreground/20 bg-background px-3 py-2.5 text-sm tracking-normal text-foreground"
              />
            </label>
            <button
              onClick={async () => {
                setTestResult("…");
                await patch({ action: "setNotify", email, whatsapp });
                setTestResult("✅ Configuración guardada");
              }}
              className="rounded-lg border border-foreground/20 px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-foreground hover:border-primary hover:text-primary"
            >
              Guardar
            </button>
            <button
              onClick={async () => {
                setTestResult("…");
                await patch({ action: "setNotify", email, whatsapp });
                const r = await fetch("/api/agenda", {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json", ...(adminKey ? { "x-agenda-key": adminKey } : {}) },
                  body: JSON.stringify({ action: "testNotify" }),
                }).then((x) => x.json());
                if (r.waMeUrl) window.open(r.waMeUrl, "_blank", "noopener,noreferrer");
                setTestResult(
                  r.emailSent && r.waMeUrl
                    ? "✅ Correo enviado y WhatsApp abierto con el aviso de prueba"
                    : r.emailSent
                      ? "✅ Correo de prueba enviado — revísalo (incluye enlace wa.me)"
                      : r.waMeUrl
                        ? "✅ WhatsApp abierto con el aviso de prueba"
                        : "Ingresa correo o WhatsApp válido para probar"
                );
              }}
              className="rounded-lg bg-primary px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-white hover:opacity-90"
            >
              Probar aviso
            </button>
          </div>
          {testResult && <p className="mt-2 text-sm font-semibold text-foreground">{testResult}</p>}
          <p className="mt-3 opacity-80">
            {waMode === "api"
              ? "Además, con el módulo de WhatsApp activo, el aviso puede llegar automático sin abrir enlaces."
              : "El aviso por WhatsApp es vía wa.me (un toque desde el correo o el botón de prueba). El push automático sin tocar nada requiere el módulo de pago con API de Meta."}
          </p>
        </div>
      )}

      {/* wa.me — contacto manual, vocabulario del rubro (ej. "cliente"/"paciente").
          Vive en la pestaña "Reservas": es una utilidad por reserva, no config. */}
      {activeTab === "reservas" && (
      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-5 text-sm text-foreground/70">
        <p className="font-semibold text-foreground">💬 Responder a cada {vocabulary.clientSingular} (wa.me)</p>
        <p className="mt-2 leading-relaxed">
          En cada reserva, el botón <strong>WhatsApp</strong> abre tu app con el mensaje listo para coordinar el abono
          o confirmar la hora — gratis, sin API.
        </p>
        {demoBooking ? (
          <a
            href={buildBookingClientWaLink(demoBooking, businessName)}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-emerald-600 hover:bg-emerald-500/20"
          >
            Probar mensaje a {vocabulary.clientSingular} (demo)
          </a>
        ) : (
          <p className="mt-3 text-foreground/60">Cuando llegue la primera reserva, el botón aparecerá ahí mismo.</p>
        )}
        {waDigits.length > 0 && waDigits.length < 8 && (
          <p className="mt-3 text-xs text-amber-600">Ingresa un WhatsApp válido arriba (ej. +56 9 1234 5678).</p>
        )}
      </div>
      )}

      {/* Sincronización con calendario (Google / Outlook / Apple) — el feed ICS
          es una URL que suscribe la app de calendario del negocio, así que
          necesita su propia clave incluso si el dueño entra con Google. */}
      {adminKey && activeTab === "config" && (
        <div className="rounded-xl border border-sky-500/30 bg-sky-500/5 p-5 text-sm text-foreground/70">
          <p className="font-semibold text-foreground">📅 Tus reservas, en tu calendario de siempre</p>
          <p className="mt-2 leading-relaxed">
            Suscríbete una sola vez y tus reservas aparecen y se actualizan solas en Google Calendar,
            Outlook o el calendario del iPhone. Además, cada correo de aviso trae un botón
            {" “"}Agregar a Google Calendar{"”"} para anotar esa hora al instante.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <code className="max-w-full overflow-x-auto rounded-lg border border-foreground/15 bg-background px-3 py-2.5 text-xs text-foreground">
              {calendarUrl}
            </code>
            <button
              onClick={() => {
                navigator.clipboard?.writeText(calendarUrl);
                setCalCopied(true);
                setTimeout(() => setCalCopied(false), 2500);
              }}
              className="rounded-lg border border-sky-500/40 bg-sky-500/10 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-sky-600 hover:bg-sky-500/20"
            >
              {calCopied ? "✓ Copiado" : "Copiar enlace"}
            </button>
          </div>
          <p className="mt-3 text-xs opacity-80">
            En Google Calendar: Otros calendarios → + → Desde URL → pega el enlace. Google lo refresca
            automáticamente cada algunas horas.
          </p>
        </div>
      )}

      {/* Duración y precio por servicio, y tope diario — solo admin */}
      {isAdmin && activeTab === "config" && (
      <section>
        <h2 className="font-heading text-xl font-bold text-foreground">Servicios: duración, precio y tope diario</h2>
        <p className="mt-1 text-sm text-foreground/60">
          Cuánto ocupa cada servicio en tu agenda y qué precio muestra (en la home y al reservar), cuántas horas
          como máximo quieres atender por día, y con cuánta anticipación mínima puede reservar un cliente (aunque
          quede hora libre, no podrá tomar una que caiga dentro de ese margen desde ahora). Si una reserva hace que
          ese día supere el tope, no se confirma sola: queda esperando tu autorización abajo.
        </p>
        <div className="mt-4 flex flex-col gap-2">
          {services.map((s) => (
            <div
              key={s.title}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-foreground/15 px-4 py-2.5 text-sm"
            >
              <span className="font-semibold text-foreground">{s.title}</span>
              <div className="flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-1.5 text-foreground/60">
                  <input
                    type="number"
                    min={5}
                    step={5}
                    value={durations[s.title] ?? s.durationMinutes ?? 60}
                    onChange={(e) =>
                      setDurations((prev) => ({ ...prev, [s.title]: Math.max(5, Number(e.target.value) || 0) }))
                    }
                    className="w-16 rounded-lg border border-foreground/20 bg-background px-2 py-1.5 text-right text-sm text-foreground"
                  />
                  min
                </label>
                <label className="flex items-center gap-1.5 text-foreground/60">
                  Precio
                  <input
                    type="text"
                    placeholder="ej. $12.000"
                    value={prices[s.title] ?? s.price ?? ""}
                    onChange={(e) => setPrices((prev) => ({ ...prev, [s.title]: e.target.value }))}
                    className="w-28 rounded-lg border border-foreground/20 bg-background px-2 py-1.5 text-sm text-foreground"
                  />
                </label>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wider text-foreground/60">
            Tope de horas reservables por día (vacío = sin tope)
            <input
              type="number"
              min={1}
              placeholder="ej. 480 (8 horas)"
              value={maxDailyMinutes}
              onChange={(e) => setMaxDailyMinutesState(e.target.value)}
              className="w-56 rounded-lg border border-foreground/20 bg-background px-3 py-2.5 text-sm normal-case tracking-normal text-foreground"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wider text-foreground/60">
            Anticipación mínima para reservar, en minutos (0 = ninguna)
            <input
              type="number"
              min={0}
              max={1440}
              step={5}
              value={minLeadMinutes}
              onChange={(e) => setMinLeadMinutesState(Number(e.target.value))}
              className="w-56 rounded-lg border border-foreground/20 bg-background px-3 py-2.5 text-sm normal-case tracking-normal text-foreground"
            />
          </label>
          <button
            onClick={saveServiceConfig}
            disabled={savingConfig}
            className="rounded-lg bg-primary px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-white hover:opacity-90 disabled:opacity-60"
          >
            {savingConfig ? "Guardando…" : "Guardar"}
          </button>
          {configSaved && <p className="text-sm font-semibold text-foreground">✅ Guardado</p>}
        </div>
      </section>
      )}

      {/* Sucursales (multicentro) — "puede ser 1 o +": con ninguna agregada
          la agenda sigue siendo de una sola ubicación; recién con 2+
          aparecen los selectores acá abajo, en Profesionales/Horario y en la
          reserva pública. */}
      {isAdmin && multiBranch && activeTab === "config" && (
        <section>
          <h2 className="font-heading text-xl font-bold text-foreground">Sucursales</h2>
          <p className="mt-1 text-sm text-foreground/60">
            Agrega tus ubicaciones — con una sola, la agenda funciona exactamente igual que sin este módulo. Desde
            2 en adelante, tus clientes eligen dónde atenderse y cada profesional queda asignado a la suya.
          </p>
          <div className="mt-4 flex flex-col gap-2">
            {branchesForm.map((b, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2 rounded-lg border border-foreground/15 p-3">
                <input
                  value={b.name}
                  onChange={(e) => setBranchesForm((prev) => prev.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                  placeholder="Nombre (ej. Sucursal Providencia)"
                  className="min-w-[180px] flex-1 rounded-lg border border-foreground/20 bg-background px-3 py-2 text-sm text-foreground"
                />
                <input
                  value={b.address}
                  onChange={(e) => setBranchesForm((prev) => prev.map((x, j) => (j === i ? { ...x, address: e.target.value } : x)))}
                  placeholder="Dirección (opcional)"
                  className="min-w-[220px] flex-1 rounded-lg border border-foreground/20 bg-background px-3 py-2 text-sm normal-case tracking-normal text-foreground"
                />
                <button
                  type="button"
                  onClick={() => removeBranch(i)}
                  className="rounded-lg border border-foreground/20 px-3 py-2 text-xs font-bold uppercase tracking-wider text-foreground/60 hover:border-primary hover:text-primary"
                >
                  Quitar
                </button>
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={addBranch}
              className="rounded-lg border border-foreground/20 px-4 py-2 text-xs font-bold uppercase tracking-wider text-foreground hover:border-primary hover:text-primary"
            >
              + Agregar sucursal
            </button>
            <button
              type="button"
              onClick={saveBranches}
              disabled={savingBranches}
              className="rounded-lg bg-primary px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-white hover:opacity-90 disabled:opacity-60"
            >
              {savingBranches ? "Guardando…" : "Guardar"}
            </button>
            {branchesSaved && <p className="text-sm font-semibold text-foreground">✅ Guardado</p>}
          </div>
        </section>
      )}

      {/* Profesionales — quiénes atienden. Vacío = agenda compartida de
          siempre (un solo calendario). Nada precargado: se arma acá, no en
          el config del sitio. */}
      {isAdmin && activeTab === "config" && (
      <section>
        <h2 className="font-heading text-xl font-bold text-foreground">{vocabulary.professionalPlural}</h2>
        <p className="mt-1 text-sm text-foreground/60">
          ¿Más de una persona atendiendo ({vocabulary.professionalExamples})? Agrégalas acá — cada una puede
          tener su propia disponibilidad y, si le pones correo, su propio acceso a este panel (agrégala también en
          Google, contacta a HarayaDev). Sin nadie agregado, sigue siendo una sola agenda para todo el negocio.
        </p>
        <div className="mt-4 flex flex-col gap-3">
          {professionalsForm.map((p, i) => (
            <div key={i} className="flex flex-col gap-2 rounded-lg border border-foreground/15 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <input
                  value={p.name}
                  onChange={(e) =>
                    setProfessionalsForm((prev) => prev.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))
                  }
                  placeholder="Nombre"
                  className="min-w-[160px] flex-1 rounded-lg border border-foreground/20 bg-background px-3 py-2 text-sm text-foreground"
                />
                <input
                  value={p.email}
                  onChange={(e) =>
                    setProfessionalsForm((prev) => prev.map((x, j) => (j === i ? { ...x, email: e.target.value } : x)))
                  }
                  placeholder="Correo (opcional, para que entre solo a lo suyo)"
                  className="min-w-[200px] flex-1 rounded-lg border border-foreground/20 bg-background px-3 py-2 text-sm normal-case tracking-normal text-foreground"
                />
                {expensesEnabled && (
                  <input
                    value={p.commissionPercent}
                    onChange={(e) =>
                      setProfessionalsForm((prev) => prev.map((x, j) => (j === i ? { ...x, commissionPercent: e.target.value } : x)))
                    }
                    type="number"
                    min="0"
                    max="100"
                    placeholder="% comisión"
                    className="w-28 rounded-lg border border-foreground/20 bg-background px-3 py-2 text-sm normal-case tracking-normal text-foreground"
                  />
                )}
                {multiBranch && branches.length > 0 && (
                  <select
                    value={p.branchId}
                    onChange={(e) =>
                      setProfessionalsForm((prev) => prev.map((x, j) => (j === i ? { ...x, branchId: e.target.value } : x)))
                    }
                    className="rounded-lg border border-foreground/20 bg-background px-3 py-2 text-sm normal-case tracking-normal text-foreground"
                  >
                    <option value="">Todas las sucursales</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                )}
                <button
                  type="button"
                  onClick={() => removeProfessional(i)}
                  className="rounded-lg border border-foreground/20 px-3 py-2 text-xs font-bold uppercase tracking-wider text-foreground/60 hover:border-primary hover:text-primary"
                >
                  Quitar
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-foreground/60">
                <span className="uppercase tracking-wider">Atiende:</span>
                {services.length === 0 ? (
                  <span>(sin servicios configurados todavía)</span>
                ) : (
                  services.map((s) => (
                    <label key={s.title} className="flex items-center gap-1.5">
                      <input
                        type="checkbox"
                        checked={p.services.includes(s.title)}
                        onChange={(e) =>
                          setProfessionalsForm((prev) =>
                            prev.map((x, j) =>
                              j !== i
                                ? x
                                : {
                                    ...x,
                                    services: e.target.checked
                                      ? [...x.services, s.title]
                                      : x.services.filter((t) => t !== s.title),
                                  }
                            )
                          )
                        }
                      />
                      {s.title}
                    </label>
                  ))
                )}
                <span className="opacity-70">(ninguno marcado = atiende todos)</span>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={addProfessional}
            className="rounded-lg border border-foreground/20 px-4 py-2 text-xs font-bold uppercase tracking-wider text-foreground hover:border-primary hover:text-primary"
          >
            + Agregar profesional
          </button>
          <button
            type="button"
            onClick={saveProfessionals}
            disabled={savingProfessionals}
            className="rounded-lg bg-primary px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-white hover:opacity-90 disabled:opacity-60"
          >
            {savingProfessionals ? "Guardando…" : "Guardar"}
          </button>
          {professionalsSaved && <p className="text-sm font-semibold text-foreground">✅ Guardado</p>}
        </div>
      </section>
      )}

      {/* Horario de atención — de dónde sale la grilla de horas de la agenda.
          Nada fijo en el sitio: se define acá, día por día. */}
      {isAdmin && activeTab === "config" && (
      <section>
        <h2 className="font-heading text-xl font-bold text-foreground">Horario de atención</h2>
        <p className="mt-1 text-sm text-foreground/60">
          De acá sale la grilla de horas que ven tus clientes al reservar — cámbialo cuando quieras, sin
          redesplegar el sitio.
        </p>
        {multiBranch && branches.length > 1 && (
          <div className="mt-3 flex flex-wrap gap-1.5 rounded-full border border-foreground/15 p-1">
            {branches.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => setActiveHoursBranch(b.id)}
                className={`rounded-full px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider transition-colors ${
                  activeHoursBranch === b.id ? "bg-primary text-white" : "text-foreground/60 hover:text-foreground"
                }`}
              >
                {b.name}
              </button>
            ))}
          </div>
        )}
        <div className="mt-4 flex flex-col gap-2">
          {hoursForm.map((h, i) => (
            <div key={i} className="flex flex-wrap items-center gap-3 rounded-lg border border-foreground/15 px-4 py-2.5 text-sm">
              <span className="w-24 font-semibold text-foreground">{WEEKDAY_LABELS[i]}</span>
              <label className="flex items-center gap-1.5 text-foreground/60">
                <input
                  type="checkbox"
                  checked={h.closed}
                  onChange={(e) =>
                    setHoursForm((prev) => prev.map((x, j) => (j === i ? { ...x, closed: e.target.checked } : x)))
                  }
                />
                Cerrado
              </label>
              {!h.closed && (
                <>
                  <input
                    type="time"
                    value={h.open}
                    onChange={(e) =>
                      setHoursForm((prev) => prev.map((x, j) => (j === i ? { ...x, open: e.target.value } : x)))
                    }
                    className="rounded-lg border border-foreground/20 bg-background px-3 py-1.5 text-sm text-foreground"
                  />
                  <span className="text-foreground/50">a</span>
                  <input
                    type="time"
                    value={h.close}
                    onChange={(e) =>
                      setHoursForm((prev) => prev.map((x, j) => (j === i ? { ...x, close: e.target.value } : x)))
                    }
                    className="rounded-lg border border-foreground/20 bg-background px-3 py-1.5 text-sm text-foreground"
                  />
                </>
              )}
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={saveHours}
            disabled={savingHours}
            className="rounded-lg bg-primary px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-white hover:opacity-90 disabled:opacity-60"
          >
            {savingHours ? "Guardando…" : "Guardar"}
          </button>
          {hoursSaved && <p className="text-sm font-semibold text-foreground">✅ Guardado</p>}
        </div>
      </section>
      )}

      {/* Reservas */}
      {activeTab === "reservas" && (
      <section>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-heading text-xl font-bold text-foreground">{vocabulary.bookingPlural}</h2>
          <div className="flex flex-wrap gap-2">
            {needsAuth > 0 && (
              <span className="rounded-full border border-red-500/40 bg-red-500/15 px-3 py-1 text-xs font-bold text-red-600">
                {needsAuth} requiere{needsAuth > 1 ? "n" : ""} autorización
              </span>
            )}
            {pending > 0 && (
              <span className="rounded-full border border-amber-500/40 bg-amber-500/15 px-3 py-1 text-xs font-bold text-amber-600">
                {pending} pendiente{pending > 1 ? "s" : ""} de abono
              </span>
            )}
          </div>
        </div>
        {!isAdmin && (
          <p className="mt-2 text-xs text-foreground/50">
            Cada cambio que hagas acá (confirmar, cancelar, bloquear) le llega avisado al administrador.
          </p>
        )}
        {loading ? (
          <p className="mt-4 text-sm text-foreground/60">Cargando…</p>
        ) : bookings.length === 0 ? (
          <p className="mt-4 text-sm text-foreground/60">Aún no hay reservas.</p>
        ) : (
          <div className="mt-4 flex flex-col gap-3">
            {bookings.map((b) => (
              <div key={b.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-foreground/15 p-4">
                <div className="min-w-[220px] flex-1">
                  <p className="text-sm font-bold text-foreground">
                    {b.service} <span className="font-normal text-foreground/50">· {b.id}</span>
                  </p>
                  <p className="text-sm text-foreground/70">
                    {new Date(b.date + "T12:00:00").toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "short" })} · {b.time} hrs — {b.name} ({b.phone})
                    {isAdmin && professionalName(b.professionalId) && ` · ${professionalName(b.professionalId)}`}
                    {multiBranch &&
                      branches.length > 1 &&
                      branches.find((br) => br.id === b.branchId) &&
                      ` · ${branches.find((br) => br.id === b.branchId)!.name}`}
                  </p>
                </div>
                <span className={`rounded-full border px-3 py-1 text-xs font-bold uppercase ${STATUS_STYLE[b.status]}`}>
                  {STATUS_LABEL[b.status]}
                </span>
                {b.status === "pendiente_autorizacion" && (
                  <button
                    onClick={() => patch({ action: "status", id: b.id, status: "pendiente" })}
                    className="rounded-lg bg-red-600 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white hover:opacity-90"
                  >
                    ⚠️ Autorizar reserva
                  </button>
                )}
                {b.status === "pendiente" && (
                  <button
                    onClick={() => patch({ action: "status", id: b.id, status: "confirmada" })}
                    className="rounded-lg bg-primary px-4 py-2 text-xs font-bold uppercase tracking-wider text-white hover:opacity-90"
                  >
                    ✓ Abono recibido — confirmar
                  </button>
                )}
                {b.status !== "cancelada" && b.phone.replace(/\D/g, "").length >= 8 && (
                  <a
                    href={buildBookingClientWaLink(b, businessName)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-xs font-bold uppercase tracking-wider text-emerald-600 hover:bg-emerald-500/20"
                  >
                    💬 WhatsApp
                  </a>
                )}
                {b.status !== "cancelada" && (
                  <a
                    href={buildGoogleCalendarUrl(b)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg border border-sky-500/40 bg-sky-500/10 px-4 py-2 text-xs font-bold uppercase tracking-wider text-sky-600 hover:bg-sky-500/20"
                  >
                    📅 Calendario
                  </a>
                )}
                {b.status !== "cancelada" && (
                  <button
                    onClick={() => patch({ action: "status", id: b.id, status: "cancelada" })}
                    className="rounded-lg border border-foreground/20 px-4 py-2 text-xs font-bold uppercase tracking-wider text-foreground/60 hover:border-primary hover:text-primary"
                  >
                    Cancelar
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
      )}

      {/* Clientes: ficha con historial, transversal a cualquier rubro que use
          la Agenda — se auto-completa sola con cada reserva (ver
          lib/booking-store.ts#upsertClientFromBooking). Solo admin, mismo
          criterio que Profesionales/Horario más arriba. */}
      {isAdmin && activeTab === "clientes" && (
        <section>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-heading text-xl font-bold text-foreground">{vocabulary.clientPlural}</h2>
            {dentalRecords && payments.length > 0 && (
              <button
                type="button"
                onClick={() =>
                  downloadCSV(
                    `pagos-${new Date().toISOString().slice(0, 10)}.csv`,
                    ["Fecha", "Cliente", "Teléfono", "Monto", "Método", "Nota"],
                    payments.map((p) => [
                      new Date(p.createdAt).toISOString().slice(0, 10),
                      clients.find((c) => c.phone === p.phone)?.name ?? p.phone,
                      p.phone,
                      p.amount,
                      PAYMENT_METHOD_LABEL[p.method],
                      p.note ?? "",
                    ])
                  )
                }
                className="rounded-full border border-foreground/15 px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider text-foreground/70 transition-colors hover:border-primary/40 hover:text-primary"
              >
                Descargar pagos (CSV)
              </button>
            )}
          </div>
          <p className="mt-1 text-sm text-foreground/60">
            Se arma sola con cada reserva — busca por nombre o teléfono para ver su historial completo y anotar lo que
            necesites (preferencias, alergias, apuntes del caso, lo que sirva para tu rubro). Útil también para detectar
            {" "}{vocabulary.clientPlural.toLowerCase()} frecuentes y armar ofertas después de X visitas.
          </p>
          {frequentClients.length > 0 && (
            <div className="mt-4 rounded-xl border border-foreground/15 p-4">
              <p className="m-0 mb-3 text-xs font-semibold uppercase tracking-wider text-foreground/60">
                {vocabulary.clientPlural} frecuentes — candidatos para una oferta por fidelidad
              </p>
              <div className="flex flex-col gap-2">
                {frequentClients.map((c) => (
                  <button
                    key={c.phone}
                    type="button"
                    onClick={() => {
                      setExpandedClient(c.phone);
                      const notes = clients.find((cl) => cl.phone === c.phone)?.notes ?? "";
                      setNotesDraft((prev) => (c.phone in prev ? prev : { ...prev, [c.phone]: notes }));
                      document.getElementById(`cliente-${c.phone}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
                    }}
                    className="flex items-center justify-between gap-3 text-left text-sm hover:text-primary"
                  >
                    <span className="font-semibold text-foreground">{c.name}</span>
                    <span className="text-xs text-foreground/50">
                      {c.visits} visitas · {clp(c.ingresos)} · última {c.lastDate}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
          <input
            className="mt-4 max-w-sm w-full rounded-lg border border-foreground/20 bg-background px-3 py-2.5 text-sm text-foreground"
            placeholder="Buscar por nombre o teléfono…"
            value={clientSearch}
            onChange={(e) => setClientSearch(e.target.value)}
          />
          {clients.length === 0 ? (
            <p className="mt-4 text-sm text-foreground/60">Todavía no hay clientes — aparecen solos con la primera reserva.</p>
          ) : (
            <div className="mt-4 flex flex-col gap-2">
              {clients
                .filter((c) => {
                  const q = clientSearch.trim().toLowerCase();
                  if (!q) return true;
                  return c.name.toLowerCase().includes(q) || c.phone.replace(/\D/g, "").includes(q.replace(/\D/g, ""));
                })
                .map((c) => {
                  const history = bookings
                    .filter((b) => b.phone === c.phone)
                    .sort((a, b) => (a.date + a.time < b.date + b.time ? 1 : -1));
                  const isOpen = expandedClient === c.phone;
                  const odontogram = odontograms.find((o) => o.phone === c.phone);
                  const periodontogram = periodontograms.find((o) => o.phone === c.phone);
                  const clientBudgets = budgets.filter((b) => b.phone === c.phone);
                  const clientPayments = payments.filter((p) => p.phone === c.phone);
                  const totalAceptado = clientBudgets.filter((b) => b.status === "aceptado").reduce((sum, b) => sum + b.total, 0);
                  const totalPagado = clientPayments.reduce((sum, p) => sum + p.amount, 0);
                  return (
                    <div key={c.phone} id={`cliente-${c.phone}`} className="rounded-xl border border-foreground/15 p-4">
                      <button
                        className="flex w-full flex-wrap items-center justify-between gap-2 text-left"
                        onClick={() => {
                          setExpandedClient(isOpen ? null : c.phone);
                          setNotesDraft((prev) => (c.phone in prev ? prev : { ...prev, [c.phone]: c.notes ?? "" }));
                        }}
                      >
                        <div>
                          <p className="text-sm font-bold text-foreground">{c.name}</p>
                          <p className="text-xs text-foreground/50">
                            {c.phone} · {history.length} visita{history.length === 1 ? "" : "s"}
                          </p>
                        </div>
                        <span className="text-xs text-foreground/40">{isOpen ? "Ocultar ▲" : "Ver ficha ▼"}</span>
                      </button>
                      {isOpen && (
                        <div className="mt-4 flex flex-col gap-4 border-t border-foreground/10 pt-4">
                          <div>
                            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground/50">Historial</p>
                            {history.length === 0 ? (
                              <p className="text-sm text-foreground/50">Sin reservas registradas todavía.</p>
                            ) : (
                              <div className="flex flex-col gap-1">
                                {history.map((b) => (
                                  <p key={b.id} className="text-sm text-foreground/70">
                                    {new Date(b.date + "T12:00:00").toLocaleDateString("es-CL", { day: "numeric", month: "short", year: "numeric" })} —{" "}
                                    {b.service}{" "}
                                    <span className={`ml-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${STATUS_STYLE[b.status]}`}>
                                      {STATUS_LABEL[b.status]}
                                    </span>
                                  </p>
                                ))}
                              </div>
                            )}
                          </div>
                          {dentalRecords && (
                            <div>
                              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground/50">
                                Odontograma <span className="normal-case text-foreground/40">(numeración FDI)</span>
                              </p>
                              <div className="flex flex-col gap-3">
                                {[
                                  { label: "Arcada superior", row: FDI_TEETH.slice(0, 16) },
                                  { label: "Arcada inferior", row: FDI_TEETH.slice(16, 32) },
                                ].map(({ label, row }) => (
                                  <div key={label}>
                                    <p className="mb-1 text-[10px] uppercase tracking-wide text-foreground/40">{label}</p>
                                    <div className="flex flex-wrap items-center gap-1">
                                      {row.map((tooth, i) => {
                                        const condition = odontogram?.teeth[tooth] ?? "sano";
                                        const key = `${c.phone}:${tooth}`;
                                        const saving = savingTooth === key;
                                        return (
                                          <div key={tooth} className={`relative ${i === 8 ? "ml-2" : ""}`}>
                                            <button
                                              type="button"
                                              disabled={saving}
                                              onClick={() => setOpenToothPopover(openToothPopover === key ? null : key)}
                                              title={`Diente ${tooth} — ${TOOTH_LABEL[condition]}`}
                                              className={`flex w-11 flex-col items-center gap-0.5 rounded-lg border px-1 py-1.5 transition-opacity ${TOOTH_COLOR[condition]} ${saving ? "opacity-50" : ""}`}
                                            >
                                              <ToothIcon className="h-5 w-5" />
                                              <span className="text-[10px] font-bold leading-none">{tooth}</span>
                                            </button>
                                            {openToothPopover === key && (
                                              <>
                                                <div className="fixed inset-0 z-10" onClick={() => setOpenToothPopover(null)} />
                                                <div className="absolute left-0 top-full z-20 mt-1 grid w-40 grid-cols-2 gap-1 rounded-xl border border-foreground/15 bg-background p-2 shadow-lg">
                                                  {TOOTH_CONDITIONS.map((cond) => (
                                                    <button
                                                      key={cond}
                                                      type="button"
                                                      onClick={() => saveTooth(c.phone, tooth, cond)}
                                                      className={`rounded-lg border px-1.5 py-1 text-left text-[10px] font-semibold leading-tight ${TOOTH_COLOR[cond]} ${cond === condition ? "ring-2 ring-primary" : ""}`}
                                                    >
                                                      {TOOTH_LABEL[cond]}
                                                    </button>
                                                  ))}
                                                </div>
                                              </>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          {dentalRecords && (
                            <div>
                              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground/50">
                                Periodontograma{" "}
                                <span className="normal-case text-foreground/40">(sondaje, sangrado y movilidad)</span>
                              </p>
                              <div className="flex flex-col gap-3">
                                {[
                                  { label: "Arcada superior", row: FDI_TEETH.slice(0, 16) },
                                  { label: "Arcada inferior", row: FDI_TEETH.slice(16, 32) },
                                ].map(({ label, row }) => (
                                  <div key={label}>
                                    <p className="mb-1 text-[10px] uppercase tracking-wide text-foreground/40">{label}</p>
                                    <div className="flex flex-wrap items-center gap-1">
                                      {row.map((tooth, i) => {
                                        const measurement = periodontogram?.teeth[tooth];
                                        const key = `${c.phone}:${tooth}`;
                                        return (
                                          <button
                                            key={tooth}
                                            type="button"
                                            onClick={() => {
                                              setOpenPerioTooth(openPerioTooth === key ? null : key);
                                              setOpenToothPopover(null);
                                            }}
                                            title={`Diente ${tooth}${measurement ? ` — máx. ${Math.max(...measurement.vestibular, ...measurement.lingual)}mm` : " — sin medir"}`}
                                            className={`relative flex w-9 flex-col items-center gap-0.5 rounded-lg border px-1 py-1 text-[10px] font-bold ${i === 8 ? "ml-2" : ""} ${perioSeverityColor(measurement)} ${openPerioTooth === key ? "ring-2 ring-primary" : ""}`}
                                          >
                                            {tooth}
                                            {measurement?.mobility ? (
                                              <span className="text-[9px] font-normal leading-none">M{measurement.mobility}</span>
                                            ) : null}
                                            {hasBleeding(measurement) && (
                                              <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-red-600" />
                                            )}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>
                                ))}
                              </div>
                              {openPerioTooth?.startsWith(`${c.phone}:`) && (
                                <PerioToothPanel
                                  tooth={openPerioTooth.slice(c.phone.length + 1)}
                                  measurement={periodontogram?.teeth[openPerioTooth.slice(c.phone.length + 1)]}
                                  saving={savingPerioTooth === openPerioTooth}
                                  onChange={(data) => savePerioTooth(c.phone, openPerioTooth.slice(c.phone.length + 1), data)}
                                  onClose={() => setOpenPerioTooth(null)}
                                />
                              )}
                            </div>
                          )}
                          {dentalRecords && (
                            <div>
                              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground/50">Presupuestos</p>
                              {clientBudgets.length > 0 && (
                                <div className="mb-3 flex flex-col gap-2">
                                  {clientBudgets.map((b) => (
                                    <div key={b.id} className="rounded-lg border border-foreground/15 p-3">
                                      <div className="flex flex-wrap items-center justify-between gap-2">
                                        <p className="text-sm font-bold text-foreground">{clp(b.total)}</p>
                                        <select
                                          className={`rounded-full border px-2 py-1 text-[10px] font-bold uppercase ${BUDGET_STATUS_STYLE[b.status]}`}
                                          value={b.status}
                                          onChange={(e) => setBudgetStatus(b.id, e.target.value as Budget["status"])}
                                        >
                                          <option value="pendiente">{BUDGET_STATUS_LABEL.pendiente}</option>
                                          <option value="aceptado">{BUDGET_STATUS_LABEL.aceptado}</option>
                                          <option value="rechazado">{BUDGET_STATUS_LABEL.rechazado}</option>
                                        </select>
                                      </div>
                                      <ul className="mt-1 text-xs text-foreground/60">
                                        {b.items.map((it, i) => (
                                          <li key={i}>
                                            {it.tooth ? `[${it.tooth}] ` : ""}
                                            {it.description} — {clp(it.price)}
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  ))}
                                </div>
                              )}
                              <div className="flex flex-col gap-2">
                                {(budgetDraft[c.phone] ?? []).map((row, i) => (
                                  <div key={i} className="flex flex-wrap items-center gap-2">
                                    <input
                                      className="min-w-[160px] flex-1 rounded-lg border border-foreground/20 bg-background px-2 py-1.5 text-sm"
                                      placeholder="Tratamiento"
                                      value={row.description}
                                      onChange={(e) => updateBudgetRow(c.phone, i, { description: e.target.value })}
                                    />
                                    <input
                                      className="w-20 rounded-lg border border-foreground/20 bg-background px-2 py-1.5 text-sm"
                                      placeholder="Diente"
                                      value={row.tooth ?? ""}
                                      onChange={(e) => updateBudgetRow(c.phone, i, { tooth: e.target.value })}
                                    />
                                    <input
                                      className="w-28 rounded-lg border border-foreground/20 bg-background px-2 py-1.5 text-sm"
                                      type="number"
                                      min="0"
                                      placeholder="Precio"
                                      value={row.price || ""}
                                      onChange={(e) => updateBudgetRow(c.phone, i, { price: Number(e.target.value) || 0 })}
                                    />
                                    <button
                                      className="rounded-lg border border-foreground/20 px-2 py-1.5 text-xs text-foreground/60 hover:border-red-500 hover:text-red-600"
                                      onClick={() => removeBudgetRow(c.phone, i)}
                                    >
                                      ✕
                                    </button>
                                  </div>
                                ))}
                                <div className="flex items-center gap-2">
                                  <button
                                    className="rounded-lg border border-foreground/20 px-3 py-1.5 text-xs font-medium hover:bg-foreground/5"
                                    onClick={() => addBudgetRow(c.phone)}
                                  >
                                    + Agregar ítem
                                  </button>
                                  {(budgetDraft[c.phone]?.length ?? 0) > 0 && (
                                    <button
                                      className="rounded-lg bg-primary px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-white hover:opacity-90 disabled:opacity-50"
                                      disabled={savingBudgetFor === c.phone}
                                      onClick={() => submitBudget(c.phone)}
                                    >
                                      {savingBudgetFor === c.phone ? "Guardando…" : "Crear presupuesto"}
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                          {dentalRecords && (
                            <div>
                              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground/50">Control de pagos</p>
                              <div className="mb-3 flex flex-wrap gap-4 text-sm">
                                <p>
                                  Aceptado: <span className="font-bold text-foreground">{clp(totalAceptado)}</span>
                                </p>
                                <p>
                                  Pagado: <span className="font-bold text-emerald-600">{clp(totalPagado)}</span>
                                </p>
                                <p>
                                  Saldo:{" "}
                                  <span className={`font-bold ${totalAceptado - totalPagado > 0 ? "text-red-600" : "text-foreground"}`}>
                                    {clp(totalAceptado - totalPagado)}
                                  </span>
                                </p>
                              </div>
                              {clientPayments.length > 0 && (
                                <div className="mb-3 flex flex-col gap-1">
                                  {clientPayments.map((p) => (
                                    <p key={p.id} className="text-xs text-foreground/60">
                                      {new Date(p.createdAt).toLocaleDateString("es-CL", { day: "numeric", month: "short", year: "numeric" })} —{" "}
                                      {clp(p.amount)} · {PAYMENT_METHOD_LABEL[p.method]}
                                      {p.note ? ` — ${p.note}` : ""}
                                    </p>
                                  ))}
                                </div>
                              )}
                              <div className="flex flex-wrap items-center gap-2">
                                <input
                                  className="w-32 rounded-lg border border-foreground/20 bg-background px-2 py-1.5 text-sm"
                                  type="number"
                                  min="0"
                                  placeholder="Monto"
                                  value={paymentDraftFor(c.phone).amount}
                                  onChange={(e) => updatePaymentDraft(c.phone, { amount: e.target.value })}
                                />
                                <select
                                  className="rounded-lg border border-foreground/20 bg-background px-2 py-1.5 text-sm"
                                  value={paymentDraftFor(c.phone).method}
                                  onChange={(e) => updatePaymentDraft(c.phone, { method: e.target.value as Payment["method"] })}
                                >
                                  {PAYMENT_METHODS.map((m) => (
                                    <option key={m} value={m}>
                                      {PAYMENT_METHOD_LABEL[m]}
                                    </option>
                                  ))}
                                </select>
                                <input
                                  className="min-w-[140px] flex-1 rounded-lg border border-foreground/20 bg-background px-2 py-1.5 text-sm"
                                  placeholder="Nota (opcional)"
                                  value={paymentDraftFor(c.phone).note}
                                  onChange={(e) => updatePaymentDraft(c.phone, { note: e.target.value })}
                                />
                                <button
                                  className="rounded-lg bg-primary px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-white hover:opacity-90 disabled:opacity-50"
                                  disabled={savingPaymentFor === c.phone}
                                  onClick={() => submitPayment(c.phone)}
                                >
                                  {savingPaymentFor === c.phone ? "Guardando…" : "Registrar pago"}
                                </button>
                              </div>
                            </div>
                          )}
                          <div>
                            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground/50">Notas</p>
                            <textarea
                              className="w-full rounded-lg border border-foreground/20 bg-background px-3 py-2.5 text-sm text-foreground"
                              rows={3}
                              placeholder="Preferencias, alergias, apuntes del caso…"
                              value={notesDraft[c.phone] ?? ""}
                              onChange={(e) => setNotesDraft((prev) => ({ ...prev, [c.phone]: e.target.value }))}
                            />
                            <button
                              className="mt-2 rounded-lg bg-primary px-4 py-2 text-xs font-bold uppercase tracking-wider text-white hover:opacity-90 disabled:opacity-50"
                              disabled={savingNotesFor === c.phone}
                              onClick={() => saveClientNotes(c.phone)}
                            >
                              {savingNotesFor === c.phone ? "Guardando…" : "Guardar notas"}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          )}
        </section>
      )}

      {/* Gastos e inventario: transversal a cualquier rubro (no solo dental),
          por eso vive fuera de la ficha de cliente — es del negocio completo. */}
      {expensesEnabled && isAdmin && activeTab === "finanzas" && (
        <section className="flex flex-col gap-6">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-heading text-xl font-bold text-foreground">Gastos</h2>
              {expensesList.length > 0 && (
                <button
                  type="button"
                  onClick={() =>
                    downloadCSV(
                      `gastos-${new Date().toISOString().slice(0, 10)}.csv`,
                      ["Fecha", "Categoría", "Descripción", "Monto"],
                      expensesList.map((e) => [e.date, e.category, e.description, e.amount])
                    )
                  }
                  className="rounded-full border border-foreground/15 px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider text-foreground/70 transition-colors hover:border-primary/40 hover:text-primary"
                >
                  Descargar CSV
                </button>
              )}
            </div>
            <div className="mt-3 flex flex-wrap items-end gap-2">
              <input
                className="rounded-lg border border-foreground/20 bg-background px-2 py-1.5 text-sm"
                type="date"
                value={expenseDraft.date}
                onChange={(e) => setExpenseDraft((prev) => ({ ...prev, date: e.target.value }))}
              />
              <select
                className="rounded-lg border border-foreground/20 bg-background px-2 py-1.5 text-sm"
                value={expenseDraft.category}
                onChange={(e) => setExpenseDraft((prev) => ({ ...prev, category: e.target.value }))}
              >
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <input
                className="min-w-[160px] flex-1 rounded-lg border border-foreground/20 bg-background px-2 py-1.5 text-sm"
                placeholder="Descripción"
                value={expenseDraft.description}
                onChange={(e) => setExpenseDraft((prev) => ({ ...prev, description: e.target.value }))}
              />
              <input
                className="w-28 rounded-lg border border-foreground/20 bg-background px-2 py-1.5 text-sm"
                type="number"
                min="0"
                placeholder="Monto"
                value={expenseDraft.amount}
                onChange={(e) => setExpenseDraft((prev) => ({ ...prev, amount: e.target.value }))}
              />
              <button
                className="rounded-lg bg-primary px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-white hover:opacity-90 disabled:opacity-50"
                disabled={savingExpense}
                onClick={submitExpense}
              >
                {savingExpense ? "Guardando…" : "Agregar gasto"}
              </button>
            </div>
            {expensesList.length > 0 && (
              <div className="mt-4 flex flex-col gap-1">
                <p className="text-sm font-semibold text-foreground">
                  Total: {clp(expensesList.reduce((sum, e) => sum + e.amount, 0))}
                </p>
                {expensesList.map((e) => (
                  <div key={e.id} className="flex items-center justify-between gap-2 rounded-lg border border-foreground/10 px-3 py-2 text-sm">
                    <span>
                      {new Date(e.date + "T12:00:00").toLocaleDateString("es-CL", { day: "numeric", month: "short" })} —{" "}
                      <span className="font-medium">{e.category}</span> · {e.description}
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="font-semibold">{clp(e.amount)}</span>
                      <button className="text-foreground/40 hover:text-red-600" onClick={() => removeExpense(e.id)}>
                        ✕
                      </button>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <h2 className="font-heading text-xl font-bold text-foreground">Inventario</h2>
            <div className="mt-3 flex flex-wrap items-end gap-2">
              <input
                className="min-w-[160px] flex-1 rounded-lg border border-foreground/20 bg-background px-2 py-1.5 text-sm"
                placeholder={`Nombre del ${vocabulary.supplyItemSingular}`}
                value={inventoryDraft.name}
                onChange={(e) => setInventoryDraft((prev) => ({ ...prev, name: e.target.value }))}
              />
              <input
                className="w-24 rounded-lg border border-foreground/20 bg-background px-2 py-1.5 text-sm"
                placeholder="Unidad"
                value={inventoryDraft.unit}
                onChange={(e) => setInventoryDraft((prev) => ({ ...prev, unit: e.target.value }))}
              />
              <input
                className="w-24 rounded-lg border border-foreground/20 bg-background px-2 py-1.5 text-sm"
                type="number"
                min="0"
                placeholder="Cantidad"
                value={inventoryDraft.quantity}
                onChange={(e) => setInventoryDraft((prev) => ({ ...prev, quantity: e.target.value }))}
              />
              <input
                className="w-28 rounded-lg border border-foreground/20 bg-background px-2 py-1.5 text-sm"
                type="number"
                min="0"
                placeholder="Mínimo (aviso)"
                value={inventoryDraft.minStock}
                onChange={(e) => setInventoryDraft((prev) => ({ ...prev, minStock: e.target.value }))}
              />
              <button
                className="rounded-lg bg-primary px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-white hover:opacity-90 disabled:opacity-50"
                disabled={savingInventoryItem}
                onClick={submitInventoryItem}
              >
                {savingInventoryItem ? "Guardando…" : "Agregar ítem"}
              </button>
            </div>
            {inventory.length > 0 && (
              <div className="mt-4 flex flex-col gap-1">
                {inventory.map((item) => {
                  const low = item.minStock !== undefined && item.quantity <= item.minStock;
                  return (
                    <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-foreground/10 px-3 py-2 text-sm">
                      <span className={low ? "font-semibold text-red-600" : ""}>
                        {item.name} — {item.quantity} {item.unit}
                        {low && " (bajo stock)"}
                      </span>
                      <span className="flex items-center gap-2">
                        <input
                          className="w-16 rounded-lg border border-foreground/20 bg-background px-2 py-1 text-xs"
                          type="number"
                          placeholder="±"
                          value={stockAdjustDraft[item.id] ?? ""}
                          onChange={(e) => setStockAdjustDraft((prev) => ({ ...prev, [item.id]: e.target.value }))}
                        />
                        <button
                          className="rounded-lg border border-foreground/20 px-3 py-1 text-xs font-medium hover:bg-foreground/5"
                          onClick={() => {
                            const delta = Number(stockAdjustDraft[item.id]);
                            if (delta) {
                              adjustStock(item.id, delta);
                              setStockAdjustDraft((prev) => ({ ...prev, [item.id]: "" }));
                            }
                          }}
                        >
                          Ajustar
                        </button>
                        <button className="text-foreground/40 hover:text-red-600" onClick={() => removeInventoryItem(item.id)}>
                          ✕
                        </button>
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      )}

      {/* Bloqueos — vive en la pestaña "Reservas", junto a la lista que bloquea. */}
      {activeTab === "reservas" && (
      <section>
        <h2 className="font-heading text-xl font-bold text-foreground">Bloquear agenda</h2>
        <p className="mt-1 text-sm text-foreground/60">
          ¿Un día libre, vacaciones o una hora que no puedes atender? Bloquéala y desaparece de la
          agenda pública al instante.
          {!isAdmin && myProfessionalId && " Solo bloqueas tu propia agenda — el resto del equipo no se ve afectado."}
        </p>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wider text-foreground/60">
            Día
            <input
              type="date"
              value={blockDate}
              onChange={(e) => setBlockDate(e.target.value)}
              className="rounded-lg border border-foreground/20 bg-background px-3 py-2.5 text-sm text-foreground"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wider text-foreground/60">
            Hora (vacío = día completo)
            <input
              type="time"
              value={blockTime}
              onChange={(e) => setBlockTime(e.target.value)}
              step={1800}
              className="rounded-lg border border-foreground/20 bg-background px-3 py-2.5 text-sm text-foreground"
            />
          </label>
          {isAdmin && professionals.length > 0 && (
            <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wider text-foreground/60">
              Para quién
              <select
                value={blockProfessional}
                onChange={(e) => setBlockProfessional(e.target.value)}
                className="rounded-lg border border-foreground/20 bg-background px-3 py-2.5 text-sm normal-case tracking-normal text-foreground"
              >
                <option value="">Todo el negocio</option>
                {professionals.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <button
            disabled={!blockDate}
            onClick={() => {
              const base = blockTime ? `${blockDate} ${blockTime}` : blockDate;
              const key = isAdmin && blockProfessional ? `${base}|${blockProfessional}` : base;
              patch({ action: "toggleBlock", key });
            }}
            className="rounded-lg bg-foreground px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-background hover:opacity-90 disabled:opacity-40"
          >
            Bloquear / desbloquear
          </button>
        </div>
        {blocked.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {blocked.map((k) => {
              const [base, profId] = k.split("|");
              const label = profId ? `${base} (${professionalName(profId) ?? profId})` : base;
              return (
                <button
                  key={k}
                  onClick={() => patch({ action: "toggleBlock", key: k })}
                  title="Click para desbloquear"
                  className="rounded-full border border-foreground/20 bg-foreground/5 px-3 py-1.5 text-xs font-semibold text-foreground/70 hover:border-primary hover:text-primary"
                >
                  🚫 {label} ✕
                </button>
              );
            })}
          </div>
        )}
      </section>
      )}

      {/* Espejo de "Bloquear agenda": horas EXTRA puntuales (ej. una sobrehora
          pasado el cierre para acomodar a una clienta) — vive junto al resto
          de la agenda. */}
      {activeTab === "reservas" && (
      <section>
        <h2 className="font-heading text-xl font-bold text-foreground">Agregar hora extra</h2>
        <p className="mt-1 text-sm text-foreground/60">
          ¿Puedes atender pasado el cierre, o en un horario que normalmente no ofreces? Agrégalo acá y
          aparece como disponible en la agenda pública solo para ese día.
          {!isAdmin && myProfessionalId && " Solo agregas hora extra en tu propia agenda."}
        </p>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wider text-foreground/60">
            Día
            <input
              type="date"
              value={extraDate}
              onChange={(e) => setExtraDate(e.target.value)}
              className="rounded-lg border border-foreground/20 bg-background px-3 py-2.5 text-sm text-foreground"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wider text-foreground/60">
            Hora
            <input
              type="time"
              value={extraTime}
              onChange={(e) => setExtraTime(e.target.value)}
              step={1800}
              className="rounded-lg border border-foreground/20 bg-background px-3 py-2.5 text-sm text-foreground"
            />
          </label>
          {isAdmin && professionals.length > 0 && (
            <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wider text-foreground/60">
              Para quién
              <select
                value={extraProfessional}
                onChange={(e) => setExtraProfessional(e.target.value)}
                className="rounded-lg border border-foreground/20 bg-background px-3 py-2.5 text-sm normal-case tracking-normal text-foreground"
              >
                <option value="">Todo el negocio</option>
                {professionals.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <button
            disabled={!extraDate || !extraTime}
            onClick={() => {
              const base = `${extraDate} ${extraTime}`;
              const key = isAdmin && extraProfessional ? `${base}|${extraProfessional}` : base;
              patch({ action: "toggleExtraSlot", key });
            }}
            className="rounded-lg bg-primary px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-white hover:opacity-90 disabled:opacity-40"
          >
            Agregar / quitar hora extra
          </button>
        </div>
        {extraSlots.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {extraSlots.map((k) => {
              const [base, profId] = k.split("|");
              const label = profId ? `${base} (${professionalName(profId) ?? profId})` : base;
              return (
                <button
                  key={k}
                  onClick={() => patch({ action: "toggleExtraSlot", key: k })}
                  title="Click para quitar"
                  className="rounded-full border border-primary/30 bg-primary/5 px-3 py-1.5 text-xs font-semibold text-primary hover:border-primary hover:opacity-80"
                >
                  ⏰ {label} ✕
                </button>
              );
            })}
          </div>
        )}
      </section>
      )}
    </div>
  );
}
