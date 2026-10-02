import { clientConfig } from "@/config/client.config";
import { listProviders } from "@/lib/realestate-store";

export const runtime = "nodejs";

// Lectura pública, sin login: el link que Rossana comparte con dueños y
// arrendatarios (/proveedores) para ver su directorio de confianza.
export async function GET() {
  if (!clientConfig.modules.inmobiliariaAdmin) return Response.json({ error: "No habilitado" }, { status: 404 });
  const providers = await listProviders();
  return Response.json({ providers: providers.map((p) => ({ category: p.category, name: p.name, phone: p.phone, notes: p.notes })) });
}
