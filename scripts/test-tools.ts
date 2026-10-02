// Prueba directa de las tools conversacionales, sin gastar cuota del modelo:
// ejecuta lo mismo que llamaría el asistente y verifica el resultado real.
import { buildStoreTools } from "../lib/store-tools";
import { buildLeadTools } from "../lib/lead-tools";
import { buildAgendaTools } from "../lib/chat-tools";
import { listOrders } from "../lib/order-store";
import { listLeads } from "../lib/lead-store";

type ToolLike = { execute?: (args: unknown, opts: unknown) => Promise<unknown> };

async function run(tool: unknown, args: unknown) {
  const t = tool as ToolLike;
  if (!t?.execute) throw new Error("tool sin execute");
  return t.execute(args, { toolCallId: "test", messages: [] });
}

async function main() {
  const store = buildStoreTools();
  const leads = buildLeadTools();
  const agenda = buildAgendaTools();

  console.log("tools disponibles:", {
    tienda: Object.keys(store),
    leads: Object.keys(leads),
    agenda: Object.keys(agenda),
  });

  if (store.crear_pedido) {
    console.log("\n--- 1. pedido con slug inventado (debe rechazar y sugerir) ---");
    console.log(
      await run(store.crear_pedido, {
        items: [{ slug: "pack-12-empanadas-congeladas", cantidad: 1 }],
        nombre: "Claudia Prueba",
        telefono: "+56 9 4444 5555",
      })
    );

    console.log("\n--- 2. pedido válido (2 productos, total server-side + Webpay) ---");
    const ok = await run(store.crear_pedido, {
      items: [
        { slug: "pack-12-empanadas", cantidad: 2 },
        { slug: "aji-verde-250", cantidad: 1 },
      ],
      nombre: "Claudia Prueba",
      telefono: "+56 9 4444 5555",
    });
    console.log(JSON.stringify(ok, null, 2));
    console.log("esperado total: 14990*2 + 3990 =", 14990 * 2 + 3990);
    console.log("pedidos en el store:", (await listOrders()).length);
  } else {
    console.log("\n(módulo tienda apagado en el config activo)");
  }

  if (leads.registrar_lead) {
    console.log("\n--- 3. lead calificado ---");
    console.log(
      await run(leads.registrar_lead, {
        nombre: "Rodrigo Comprador",
        telefono: "+56 9 7777 8888",
        operacion: "compra",
        comunas: ["Reñaca", "Concón"],
        presupuesto: "hasta 6.000 UF",
        plazo: "3 meses",
      })
    );
    const leadsGuardados = await listLeads();
    console.log("leads en el store:", leadsGuardados.length, JSON.stringify(leadsGuardados[0] ?? null));
  } else {
    console.log("\n(módulo propiedades apagado en el config activo)");
  }
}

main().catch((e) => {
  console.error("FALLÓ:", e);
  process.exit(1);
});
