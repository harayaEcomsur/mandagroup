import { clientConfig } from "@/config/client.config";
import { currentBroker } from "@/lib/realestate-auth";
import { getDelivery, listProperties } from "@/lib/realestate-store";
import { buildDeliveryPdf } from "@/lib/pdf-entrega";

export const runtime = "nodejs";

function claveFromRequest(req: Request): string | null {
  return req.headers.get("x-re-key") ?? new URL(req.url).searchParams.get("clave");
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
  if (!clientConfig.modules.inmobiliariaAdmin) return new Response("No habilitado", { status: 404 });
  const broker = await currentBroker(claveFromRequest(req));
  if (!broker) return new Response("No autorizado", { status: 401 });

  const delivery = await getDelivery(params.id);
  if (!delivery) return new Response("No encontrado", { status: 404 });
  if (broker.role !== "admin" && delivery.brokerId !== broker.id) return new Response("No autorizado", { status: 403 });

  const properties = await listProperties();
  const property = properties.find((p) => p.id === delivery.propertyId) ?? null;
  const pdf = await buildDeliveryPdf(delivery, { businessName: clientConfig.meta.businessName, property, brokerName: broker.name });

  return new Response(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="informe-entrega-${delivery.id.slice(0, 8)}.pdf"`,
    },
  });
}
