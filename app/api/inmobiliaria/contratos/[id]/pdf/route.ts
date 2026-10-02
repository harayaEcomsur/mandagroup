import { clientConfig } from "@/config/client.config";
import { currentBroker } from "@/lib/realestate-auth";
import { listContracts, listContractTemplates, renderContract } from "@/lib/realestate-store";
import { buildContractPdf } from "@/lib/pdf-contrato";

export const runtime = "nodejs";

function claveFromRequest(req: Request): string | null {
  return req.headers.get("x-re-key") ?? new URL(req.url).searchParams.get("clave");
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
  if (!clientConfig.modules.inmobiliariaAdmin) return new Response("No habilitado", { status: 404 });
  const broker = await currentBroker(claveFromRequest(req));
  if (!broker) return new Response("No autorizado", { status: 401 });

  const contracts = await listContracts();
  const contract = contracts.find((c) => c.id === params.id);
  if (!contract) return new Response("No encontrado", { status: 404 });
  if (broker.role !== "admin" && contract.brokerId !== broker.id) return new Response("No autorizado", { status: 403 });

  const templates = await listContractTemplates();
  const template = templates.find((t) => t.id === contract.templateId);
  if (!template) return new Response("Plantilla no encontrada", { status: 404 });

  const rendered = renderContract(template, contract.variables);
  const pdf = await buildContractPdf({
    businessName: clientConfig.meta.businessName,
    templateName: template.name,
    renderedText: rendered,
    date: new Date(contract.createdAt).toLocaleDateString("es-CL"),
  });

  return new Response(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="contrato-${contract.id.slice(0, 8)}.pdf"`,
    },
  });
}
