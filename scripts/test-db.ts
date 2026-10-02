// Prueba de la capa de persistencia contra un Postgres real (DATABASE_URL).
// Verifica que los datos sobrevivan al proceso y que la base evite dobles
// reservas del mismo horario. Uso:
//   DATABASE_URL=postgres://... npx tsx scripts/test-db.ts [--limpiar]
import { hasDb, db, ensureSchema } from "../lib/db";
import { createBooking, listBookings, slotsForDate, setBookingPaid, getBooking, toggleBlocked, listBlocked, consumeNotifyQuota, setNotify, getNotify } from "../lib/booking-store";
import { createOrder, getOrder, setOrderResult, listOrders } from "../lib/order-store";
import { createLead, listLeads } from "../lib/lead-store";
import { logChat, recentChats } from "../lib/chat-log";
import { getHistory, appendHistory } from "../lib/wa-history";

function check(label: string, condition: boolean, extra?: unknown) {
  console.log(`${condition ? "✅" : "❌"} ${label}${extra !== undefined ? " → " + JSON.stringify(extra) : ""}`);
  if (!condition) process.exitCode = 1;
}

async function main() {
  if (!hasDb()) {
    console.error("Falta DATABASE_URL — esta prueba requiere una base real.");
    process.exit(1);
  }

  if (process.argv.includes("--limpiar")) {
    await ensureSchema();
    const sql = db();
    await sql`TRUNCATE bookings, blocked_slots, settings, orders, leads, chat_log, wa_threads`;
    console.log("tablas vaciadas\n");
  }

  await ensureSchema();
  console.log("esquema creado/verificado\n");

  // --- Reservas ---
  const slots = await slotsForDate(mañana());
  check("hay horarios disponibles mañana", slots.some((s) => s.available), slots.length + " slots");
  const hora = slots.find((s) => s.available)!.time;

  const reserva = await createBooking({
    service: "Corte de prueba",
    date: mañana(),
    time: hora,
    name: "Persistencia QA",
    phone: "+56 9 1111 1111",
  });
  check("reserva creada", !("error" in reserva), reserva);

  const duplicada = await createBooking({
    service: "Otro servicio",
    date: mañana(),
    time: hora,
    name: "Segunda Persona",
    phone: "+56 9 2222 2222",
  });
  check("la misma hora NO se puede reservar dos veces", "error" in duplicada, duplicada);

  const slotsDespues = await slotsForDate(mañana());
  check("la hora reservada ya no aparece libre", !slotsDespues.find((s) => s.time === hora)?.available);

  if (!("error" in reserva)) {
    await setBookingPaid(reserva.id, { amount: 5000, authorizationCode: "QA123", cardLast4: "6623" });
    const confirmada = await getBooking(reserva.id);
    check("abono confirma la reserva", confirmada?.status === "confirmada" && confirmada?.payment?.amount === 5000, {
      status: confirmada?.status,
      payment: confirmada?.payment,
    });
  }

  // --- Bloqueos ---
  const clave = `${mañana()} 09:00`;
  const b1 = await toggleBlocked(clave);
  const bloqueados = await listBlocked();
  const b2 = await toggleBlocked(clave);
  check("bloquear/desbloquear horario", b1.blocked && bloqueados.includes(clave) && !b2.blocked);

  // --- Avisos ---
  await setNotify({ email: "qa@ejemplo.cl", whatsapp: "+56 9 3333 3333" });
  const notify = await getNotify();
  check("preferencias de aviso persisten", notify.email === "qa@ejemplo.cl", notify);
  const quota = await consumeNotifyQuota(2);
  const quota2 = await consumeNotifyQuota(2);
  const quota3 = await consumeNotifyQuota(2);
  check("el tope diario de avisos se respeta", quota && quota2 && !quota3, { quota, quota2, quota3 });

  // --- Pedidos ---
  const pedido = await createOrder({
    items: [{ slug: "qa-item", name: "Item QA", price: 9990, qty: 3 }],
    total: 29970,
    buyer: { name: "Comprador QA", email: "qa@ejemplo.cl", phone: "+56 9 4444 4444" },
  });
  await setOrderResult(pedido.id, "pagada", { authorizationCode: "AUTH9", cardLast4: "0044" });
  const pedidoLeido = await getOrder(pedido.id);
  check("pedido persiste con su resultado de pago", pedidoLeido?.status === "pagada" && pedidoLeido?.total === 29970, {
    status: pedidoLeido?.status,
    auth: pedidoLeido?.authorizationCode,
    items: pedidoLeido?.items.length,
  });

  // --- Leads ---
  const lead = await createLead({
    nombre: "Lead QA",
    telefono: "+56 9 5555 5555",
    operacion: "compra",
    comunas: ["Reñaca", "Concón"],
    presupuesto: "hasta 6.000 UF",
  });
  const leads = await listLeads();
  const leido = leads.find((l) => l.id === lead.id);
  check("lead persiste con sus comunas", leido?.comunas.length === 2 && leido?.presupuesto === "hasta 6.000 UF", leido);

  // --- Registro de conversaciones (base del resumen diario) ---
  logChat({ canal: "web", userText: "¿tienen hora mañana?", assistantText: "Sí, a las 10:00" });
  await new Promise((r) => setTimeout(r, 300)); // el registro no bloquea la respuesta
  const chats = await recentChats(24);
  check("las conversaciones quedan registradas para el resumen", chats.length >= 1, chats.length + " registros");

  // --- Historial de WhatsApp (continuidad entre isolates) ---
  const fono = "56911112222";
  await appendHistory(fono, { role: "user", content: "hola" }, { role: "assistant", content: "¡Hola! ¿En qué te ayudo?" });
  await appendHistory(fono, { role: "user", content: "quiero hora el jueves" });
  const hist = await getHistory(fono);
  check("el asistente recuerda la conversación de WhatsApp", hist.length === 3 && hist[2].content === "quiero hora el jueves", hist.length + " turnos");

  console.log(`\ntotales en la base: ${(await listBookings()).length} reservas, ${(await listOrders()).length} pedidos, ${leads.length} leads`);
  await db().end();
}

function mañana(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

main().catch((e) => {
  console.error("FALLÓ:", e);
  process.exit(1);
});
