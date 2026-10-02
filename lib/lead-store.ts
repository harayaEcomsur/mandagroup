import { db, jsonb, withDb } from "@/lib/db";

// Almacén de leads calificados del módulo inmobiliario.
//
// Con DATABASE_URL (Neon) los leads se guardan en Postgres — un lead capturado
// por el asistente no puede perderse. Sin DATABASE_URL vive en memoria
// (globalThis), suficiente para demos. Ver lib/db.ts.
// Sin datos sembrados: un lead solo existe si alguien realmente conversó.

export interface Lead {
  id: string; // 6 caracteres en mayúsculas, mismo formato que las reservas
  nombre: string;
  telefono: string;
  operacion: "compra" | "arriendo" | "no_sabe";
  comunas: string[];
  presupuesto?: string;
  plazo?: string;
  propiedadInteres?: string; // slug de una propiedad publicada (config.properties)
  notas?: string;
  createdAt: string;
}

interface Store {
  leads: Lead[];
}

const g = globalThis as unknown as { __leadStore?: Store };

function store(): Store {
  if (!g.__leadStore) {
    g.__leadStore = { leads: [] };
  }
  return g.__leadStore;
}

// Fila de Postgres → Lead. Las columnas opcionales llegan como null.
function rowToLead(r: Record<string, unknown>): Lead {
  return {
    id: String(r.id),
    nombre: String(r.nombre),
    telefono: String(r.telefono),
    operacion: r.operacion as Lead["operacion"],
    comunas: (r.comunas as string[]) ?? [],
    presupuesto: (r.presupuesto as string | null) ?? undefined,
    plazo: (r.plazo as string | null) ?? undefined,
    propiedadInteres: (r.propiedad_interes as string | null) ?? undefined,
    notas: (r.notas as string | null) ?? undefined,
    createdAt: new Date(r.created_at as string).toISOString(),
  };
}

export async function createLead(data: Omit<Lead, "id" | "createdAt">): Promise<Lead> {
  const lead: Lead = {
    ...data,
    id: Math.random().toString(36).slice(2, 8).toUpperCase(),
    createdAt: new Date().toISOString(),
  };

  return withDb(
    async () => {
      const sql = db();
      await sql`
        INSERT INTO leads (id, nombre, telefono, operacion, comunas, presupuesto, plazo, propiedad_interes, notas, created_at)
        VALUES (${lead.id}, ${lead.nombre}, ${lead.telefono}, ${lead.operacion},
                ${jsonb(lead.comunas)}, ${lead.presupuesto ?? null}, ${lead.plazo ?? null},
                ${lead.propiedadInteres ?? null}, ${lead.notas ?? null}, ${lead.createdAt})
      `;
      return lead;
    },
    () => {
      store().leads.push(lead);
      return lead;
    }
  );
}

export async function listLeads(): Promise<Lead[]> {
  return withDb(
    async () => {
      const sql = db();
      const rows = await sql`SELECT * FROM leads ORDER BY created_at DESC`;
      return rows.map((r) => rowToLead(r as Record<string, unknown>));
    },
    // Más recientes primero: el dueño quiere ver el último lead arriba.
    () => [...store().leads].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  );
}
