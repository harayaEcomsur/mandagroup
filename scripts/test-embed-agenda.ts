#!/usr/bin/env tsx
// Prueba del motor de agenda por tenant (lib/embed-agenda.ts) sin gastar cuota
// del modelo: valida grilla de horarios desde el horario del tenant, día cerrado,
// y que crear una reserva ocupe el slot. Correr: npx tsx scripts/test-embed-agenda.ts
import { getEmbedTenant } from "../config/embed-tenants";
import { slotsForDate, createBooking } from "../lib/embed-agenda";

let fail = 0;
const check = (name: string, cond: boolean) => {
  console.log(`${cond ? "✓" : "✗"} ${name}`);
  if (!cond) fail++;
};

// Próximo día de la semana `dow` (0=domingo), usando EXACTAMENTE el mismo cálculo
// de weekday que el motor (new Date(date+"T12:00:00").getDay()) para evitar drift
// UTC/local: escanea hacia adelante hasta que el día calce.
function next(dow: number): string {
  const base = new Date();
  for (let i = 1; i <= 14; i++) {
    const d = new Date(base);
    d.setDate(d.getDate() + i);
    const iso = d.toISOString().slice(0, 10);
    if (new Date(iso + "T12:00:00").getDay() === dow) return iso;
  }
  throw new Error("no encontró el día");
}

async function main() {
  const t = getEmbedTenant("demo")!;
  check("tenant demo tiene agenda", !!t.agenda);

  const martes = next(2);
  const lunes = next(1);

  const slotsMartes = await slotsForDate(t, martes);
  // Martes 10:00–19:00, slots de 60' → inicios 10:00…18:00 = 9 slots.
  check(`martes ${martes} genera 9 slots`, slotsMartes.length === 9);
  check("primer slot martes = 10:00", slotsMartes[0]?.time === "10:00");
  check("último slot martes = 18:00", slotsMartes[slotsMartes.length - 1]?.time === "18:00");
  check("todos libres al inicio", slotsMartes.every((s) => s.available));

  check(`lunes ${lunes} cerrado (0 slots)`, (await slotsForDate(t, lunes)).length === 0);

  // Crear una reserva y confirmar que ocupa el slot.
  const r = await createBooking(t, { service: "Manicure tradicional", date: martes, time: "11:00", name: "Test", phone: "+56 9 1111 2222" });
  check("reserva creada", !("error" in r));
  const reslots = await slotsForDate(t, martes);
  check("11:00 quedó ocupado", reslots.find((s) => s.time === "11:00")?.available === false);
  check("10:00 sigue libre", reslots.find((s) => s.time === "10:00")?.available === true);

  // Doble reserva del mismo slot debe fallar.
  const r2 = await createBooking(t, { service: "Manicure tradicional", date: martes, time: "11:00", name: "Otra", phone: "+56 9 3333 4444" });
  check("doble reserva del mismo slot rechazada", "error" in r2);

  console.log(fail === 0 ? "\nTODO OK" : `\n${fail} FALLAS`);
  process.exit(fail === 0 ? 0 : 1);
}

main();
