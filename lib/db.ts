import postgres from "postgres";

// Capa de persistencia opcional. Con DATABASE_URL apuntando a Postgres (Neon en
// producción), reservas, pedidos, leads y el historial del asistente sobreviven
// a los reinicios y son los mismos para todos los isolates de Vercel. Sin
// DATABASE_URL, los stores siguen funcionando en memoria: las demos no
// necesitan base de datos y arrancan sin configurar nada.
//
// Con Neon usa el connection string POOLED (el que trae "-pooler"): en
// funciones serverless cada invocación abre su propia conexión.

let client: ReturnType<typeof postgres> | null = null;
let schemaReady: Promise<void> | null = null;

export function hasDb(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

export function db() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL no está definida");
  if (!client) {
    const url = process.env.DATABASE_URL;
    const local = url.includes("localhost") || url.includes("127.0.0.1");
    // Los connection strings "pooled" (PgBouncer en modo transacción) no
    // soportan prepared statements: Neon los marca con "-pooler" y Supabase con
    // el puerto 6543. Sin esto, las consultas fallan con un error confuso.
    const pooled = url.includes("-pooler") || url.includes(":6543") || url.includes("pgbouncer=true");

    client = postgres(url, {
      // Una conexión por isolate: en serverless no hay proceso largo que reutilizar.
      max: 1,
      idle_timeout: 20,
      connect_timeout: 10,
      prepare: !pooled,
      // Neon y Supabase exigen TLS; en Postgres local (docker) no hay certificado.
      ssl: local ? false : "require",
      onnotice: () => {},
    });
  }
  return client;
}

// Crea las tablas si faltan. Idempotente y cacheada por isolate: el primer
// request que toque la base paga el costo, el resto no. Así el template no
// necesita un paso de migración manual al desplegar un cliente nuevo.
export function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      const sql = db();
      await sql`
        CREATE TABLE IF NOT EXISTS bookings (
          id TEXT PRIMARY KEY,
          service TEXT NOT NULL,
          date TEXT NOT NULL,
          time TEXT NOT NULL,
          name TEXT NOT NULL,
          phone TEXT NOT NULL,
          status TEXT NOT NULL,
          payment JSONB,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `;
      // Duración reservada en minutos, guardada al momento de la reserva (así un
      // cambio posterior de duración del servicio no altera reservas pasadas).
      // ADD COLUMN IF NOT EXISTS: bases ya provisionadas antes de este campo
      // (clientes reales) migran solas en el próximo request, sin paso manual.
      await sql`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS duration_minutes INTEGER NOT NULL DEFAULT 60`;
      // Qué profesional atiende esta reserva. "_shared" (el default) es el
      // calendario único de siempre para clientes que no usan profesionales —
      // NOT NULL a propósito: un NULL no chocaría con otro NULL en el índice
      // único de abajo, y dos reservas "sin profesional" SÍ deben chocar entre
      // sí a la misma hora. Ver lib/booking-store.ts (SHARED_PROFESSIONAL_ID).
      await sql`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS professional_id TEXT NOT NULL DEFAULT '_shared'`;
      // Sucursal donde se atiende (requiere modules.multiBranch). Mismo criterio
      // que professional_id: "_shared" de default, sin paso de migración manual
      // para clientes reales que agregan sucursales después. No entra en el
      // índice único de abajo porque un profesional pertenece a una sola
      // sucursal — el choque de horario ya lo cubre (date, time, professional_id).
      await sql`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS branch_id TEXT NOT NULL DEFAULT '_shared'`;
      await sql`CREATE INDEX IF NOT EXISTS bookings_date_idx ON bookings (date)`;
      // Dos personas no pueden tomar la misma hora CON EL MISMO PROFESIONAL: lo
      // garantiza la base, no el código de la aplicación (dos requests
      // simultáneos pasarían la validación previa y solo uno pasa este índice).
      // Dos profesionales SÍ pueden tener reservas distintas a la misma hora.
      await sql`DROP INDEX IF EXISTS bookings_slot_unico`;
      await sql`
        CREATE UNIQUE INDEX IF NOT EXISTS bookings_slot_unico
        ON bookings (date, time, professional_id) WHERE status <> 'cancelada'
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS blocked_slots (
          key TEXT PRIMARY KEY
        )
      `;
      // Espejo de blocked_slots pero en el sentido contrario: horas EXTRA que
      // el negocio ofrece más allá de su horario normal (ej. "sobrehora"
      // pasado el cierre) — mismo formato de key ("YYYY-MM-DD HH:mm" o con
      // "|profId" al final). Ver buildSlots en booking-store.ts.
      await sql`
        CREATE TABLE IF NOT EXISTS extra_slots (
          key TEXT PRIMARY KEY
        )
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY,
          value JSONB NOT NULL
        )
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS orders (
          id TEXT PRIMARY KEY,
          items JSONB NOT NULL,
          total INTEGER NOT NULL,
          buyer JSONB NOT NULL,
          status TEXT NOT NULL,
          authorization_code TEXT,
          card_last4 TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS leads (
          id TEXT PRIMARY KEY,
          nombre TEXT NOT NULL,
          telefono TEXT NOT NULL,
          operacion TEXT NOT NULL,
          comunas JSONB NOT NULL,
          presupuesto TEXT,
          plazo TEXT,
          propiedad_interes TEXT,
          notas TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS chat_log (
          id BIGSERIAL PRIMARY KEY,
          canal TEXT NOT NULL,
          user_text TEXT NOT NULL,
          assistant_text TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `;
      await sql`CREATE INDEX IF NOT EXISTS chat_log_created_idx ON chat_log (created_at DESC)`;
      await sql`
        CREATE TABLE IF NOT EXISTS wa_threads (
          phone TEXT PRIMARY KEY,
          turns JSONB NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `;
      // Mismo patrón que wa_threads, para el asistente respondiendo por
      // Instagram Direct — sender_id es el IGSID (id de la persona en el hilo),
      // no un teléfono.
      await sql`
        CREATE TABLE IF NOT EXISTS ig_threads (
          sender_id TEXT PRIMARY KEY,
          turns JSONB NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `;

      // Ficha de cliente de la Agenda: transversal a cualquier rubro que la use
      // (peluquería, barbería, dentista, abogado) — mismo patrón que re_clients
      // en Plan Inmobiliaria, pero acá se auto-completa sola al reservar (ver
      // upsertClientFromBooking en lib/booking-store.ts), sin que el negocio
      // tenga que cargar nada a mano. phone como PK: dedupe natural, mismo
      // patrón que wa_threads arriba.
      await sql`
        CREATE TABLE IF NOT EXISTS clients (
          phone TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          email TEXT,
          notes TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `;
      // Backfill de una sola vez: clientes reales que ya reservaban ANTES de
      // que existiera esta tabla no deben verse "sin historial" — ON CONFLICT
      // DO NOTHING hace que corra gratis en cada isolate sin duplicar ni pisar
      // notas ya escritas después del primer llenado.
      await sql`
        INSERT INTO clients (phone, name, created_at, updated_at)
        SELECT DISTINCT ON (phone) phone, name, created_at, created_at
        FROM bookings
        ORDER BY phone, created_at DESC
        ON CONFLICT (phone) DO NOTHING
      `;

      // Ficha dental (requiere modules.dentalRecords) — odontograma y
      // presupuestos, siempre colgando de la ficha de cliente de arriba
      // (phone). Ver lib/booking-store.ts.
      await sql`
        CREATE TABLE IF NOT EXISTS odontograms (
          phone TEXT PRIMARY KEY,
          teeth JSONB NOT NULL DEFAULT '{}',
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `;
      // Periodontograma (mismo patrón que odontograms, requiere modules.dentalRecords):
      // sondaje/sangrado/movilidad por diente. Ver lib/dental.ts (PeriodontalMeasurement).
      await sql`
        CREATE TABLE IF NOT EXISTS periodontograms (
          phone TEXT PRIMARY KEY,
          teeth JSONB NOT NULL DEFAULT '{}',
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS budgets (
          id TEXT PRIMARY KEY,
          phone TEXT NOT NULL,
          items JSONB NOT NULL,
          total NUMERIC NOT NULL,
          status TEXT NOT NULL DEFAULT 'pendiente',
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `;
      await sql`CREATE INDEX IF NOT EXISTS budgets_phone_idx ON budgets (phone)`;
      await sql`
        CREATE TABLE IF NOT EXISTS payments (
          id TEXT PRIMARY KEY,
          phone TEXT NOT NULL,
          budget_id TEXT,
          amount NUMERIC NOT NULL,
          method TEXT NOT NULL,
          note TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `;
      await sql`CREATE INDEX IF NOT EXISTS payments_phone_idx ON payments (phone)`;

      // Gastos e inventario (modules.expenses) — transversal a cualquier
      // rubro que use la Agenda, no solo dental. Ver lib/booking-store.ts.
      await sql`
        CREATE TABLE IF NOT EXISTS expenses (
          id TEXT PRIMARY KEY,
          date TEXT NOT NULL,
          category TEXT NOT NULL,
          description TEXT NOT NULL,
          amount NUMERIC NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS inventory_items (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          unit TEXT NOT NULL,
          quantity NUMERIC NOT NULL DEFAULT 0,
          min_stock NUMERIC,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `;

      // Módulo Plan Inmobiliaria (panel multi-corredor): ver lib/realestate-store.ts.
      await sql`
        CREATE TABLE IF NOT EXISTS re_brokers (
          id TEXT PRIMARY KEY,
          email TEXT NOT NULL UNIQUE,
          name TEXT NOT NULL,
          role TEXT NOT NULL,
          active BOOLEAN NOT NULL DEFAULT true,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS re_clients (
          id TEXT PRIMARY KEY,
          broker_id TEXT NOT NULL,
          name TEXT NOT NULL,
          phone TEXT,
          email TEXT,
          tipo TEXT NOT NULL,
          notas TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS re_properties (
          id TEXT PRIMARY KEY,
          broker_id TEXT NOT NULL,
          title TEXT NOT NULL,
          operation TEXT NOT NULL,
          type TEXT NOT NULL,
          address TEXT,
          price TEXT,
          description TEXT,
          photos JSONB NOT NULL DEFAULT '[]',
          status TEXT NOT NULL DEFAULT 'activa',
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `;
      // Campos para dejar cada propiedad lista para publicar en Portal
      // Inmobiliario (MercadoLibre) sin tener que volver a pedirle los datos a
      // la corredora después — ver PROPERTY_TO_ML_ATTRIBUTES en
      // lib/realestate-store.ts para el mapeo a los atributos reales de su
      // API. `price` sigue TEXT a propósito (no romper datos ya cargados en
      // otros clientes del panel inmobiliario): la app ahora guarda ahí un
      // número, y lee valores antiguos con formato ("$120.000.000") de forma
      // tolerante — ver parseLegacyPrice.
      await sql`ALTER TABLE re_properties ADD COLUMN IF NOT EXISTS region TEXT`;
      await sql`ALTER TABLE re_properties ADD COLUMN IF NOT EXISTS city TEXT`;
      await sql`ALTER TABLE re_properties ADD COLUMN IF NOT EXISTS neighborhood TEXT`;
      await sql`ALTER TABLE re_properties ADD COLUMN IF NOT EXISTS currency TEXT`;
      await sql`ALTER TABLE re_properties ADD COLUMN IF NOT EXISTS bedrooms INTEGER`;
      await sql`ALTER TABLE re_properties ADD COLUMN IF NOT EXISTS bathrooms INTEGER`;
      await sql`ALTER TABLE re_properties ADD COLUMN IF NOT EXISTS covered_area NUMERIC`;
      await sql`ALTER TABLE re_properties ADD COLUMN IF NOT EXISTS total_area NUMERIC`;
      await sql`ALTER TABLE re_properties ADD COLUMN IF NOT EXISTS parking_spots INTEGER`;
      await sql`ALTER TABLE re_properties ADD COLUMN IF NOT EXISTS storage_units INTEGER`;
      await sql`ALTER TABLE re_properties ADD COLUMN IF NOT EXISTS maintenance_fee NUMERIC`;
      await sql`ALTER TABLE re_properties ADD COLUMN IF NOT EXISTS pets_allowed BOOLEAN`;
      await sql`ALTER TABLE re_properties ADD COLUMN IF NOT EXISTS furnished BOOLEAN`;
      await sql`ALTER TABLE re_properties ADD COLUMN IF NOT EXISTS condition TEXT`;
      await sql`
        CREATE TABLE IF NOT EXISTS re_providers (
          id TEXT PRIMARY KEY,
          category TEXT NOT NULL,
          name TEXT NOT NULL,
          phone TEXT,
          notes TEXT,
          added_by TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS re_deliveries (
          id TEXT PRIMARY KEY,
          property_id TEXT,
          tipo TEXT NOT NULL,
          broker_id TEXT NOT NULL,
          arrendador JSONB,
          arrendatario JSONB,
          checklist JSONB NOT NULL DEFAULT '[]',
          meter_readings JSONB,
          photos JSONB NOT NULL DEFAULT '[]',
          notes TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `;
      await sql`CREATE INDEX IF NOT EXISTS re_deliveries_property_idx ON re_deliveries (property_id)`;
      await sql`
        CREATE TABLE IF NOT EXISTS re_contract_templates (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          operation TEXT NOT NULL,
          body TEXT NOT NULL,
          variables JSONB NOT NULL DEFAULT '[]',
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `;
      // Solicitudes de derechos ARCO+ (Ley 21.719) — ver lib/privacy-store.ts.
      // plazo_respuesta = created_at + 30 días, el plazo legal de respuesta,
      // para poder mostrar/auditar si se contestó a tiempo.
      await sql`
        CREATE TABLE IF NOT EXISTS privacy_requests (
          id TEXT PRIMARY KEY,
          tipo TEXT NOT NULL,
          nombre TEXT NOT NULL,
          contacto TEXT NOT NULL,
          detalle TEXT,
          estado TEXT NOT NULL DEFAULT 'pendiente',
          plazo_respuesta TIMESTAMPTZ NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS re_contracts (
          id TEXT PRIMARY KEY,
          template_id TEXT NOT NULL,
          property_id TEXT,
          broker_id TEXT NOT NULL,
          variables JSONB NOT NULL DEFAULT '{}',
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `;

      // Módulo eventos (discotecas/fiestas, requiere modules.eventos): eventos
      // activos con su link de venta de entradas — editable desde
      // /eventos/admin, nunca hardcodeado (el link cambia por evento). Ver
      // lib/mandagroup-store.ts.
      await sql`
        CREATE TABLE IF NOT EXISTS mandagroup_events (
          id TEXT PRIMARY KEY,
          venue TEXT NOT NULL,
          title TEXT NOT NULL,
          ticket_url TEXT NOT NULL,
          -- Fecha REAL del evento ("YYYY-MM-DD", TEXT igual que bookings.date
          -- — evita el desfase de zona horaria de un DATE nativo), no solo
          -- texto libre en el título: así el asistente sabe cuál es el
          -- próximo sin tener que adivinar leyendo el título, y un evento ya
          -- pasado deja de ofrecerse solo (ver listActiveEvents en
          -- lib/mandagroup-store.ts), sin depender de que alguien se acuerde
          -- de desactivarlo a mano.
          event_date TEXT NOT NULL,
          active BOOLEAN NOT NULL DEFAULT true,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `;
      // Historial de derivaciones (reserva/invitación) del asistente, para las
      // estadísticas del panel — separado de chat_log porque acá interesa el
      // conteo por tipo/local/canal, no el texto de la conversación.
      await sql`
        CREATE TABLE IF NOT EXISTS mandagroup_derivations (
          id BIGSERIAL PRIMARY KEY,
          canal TEXT NOT NULL,
          tipo TEXT NOT NULL,
          venue TEXT,
          event_id TEXT,
          -- Título del evento AL MOMENTO de la derivación (no un join contra
          -- mandagroup_events): así "qué alternativa clickeó" sigue siendo
          -- legible en las estadísticas aunque el evento se edite o borre
          -- después.
          event_title TEXT,
          -- El mensaje del cliente que gatilló esta derivación — para poder
          -- leer el contexto real, no solo el conteo. Ver lib/mandagroup-tools.ts.
          user_message TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `;
      await sql`CREATE INDEX IF NOT EXISTS mandagroup_derivations_created_idx ON mandagroup_derivations (created_at DESC)`;
    })().catch((error) => {
      // Si falla la creación, no cachear el fallo: el próximo request reintenta.
      schemaReady = null;
      throw error;
    });
  }
  return schemaReady;
}

// Envuelve una operación contra la base: si no hay DATABASE_URL, o si la base
// falla, se usa el camino en memoria. Nunca se cae un sitio de cliente por un
// problema de la base — se registra y se degrada.
export async function withDb<T>(operation: () => Promise<T>, fallback: () => T | Promise<T>): Promise<T> {
  if (!hasDb()) return fallback();
  try {
    await ensureSchema();
    return await operation();
  } catch (error) {
    console.error("[db] operación falló, usando memoria:", error);
    return fallback();
  }
}

// Envuelve un valor para una columna jsonb. Ojo: pasar un JSON.stringify con
// cast `::jsonb` NO es equivalente — guarda el texto como jsonb de tipo string
// y al leerlo vuelve un string en vez del objeto. postgres.js tipa `sql.json`
// con su propio JSONValue, que no acepta arrays de interfaces aunque sean JSON
// válido; el cast necesario vive acá y no repartido por los stores.
export function jsonb(value: unknown) {
  const sql = db();
  return sql.json(value as Parameters<typeof sql.json>[0]);
}
