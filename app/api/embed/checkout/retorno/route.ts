import { commitTransaction, isApproved } from "@/lib/webpay";
import { getEmbedTenant } from "@/config/embed-tenants";
import { embedWebpayEnv } from "@/lib/embed-webpay";
import { setOrderStatus } from "@/lib/embed-store";

export const runtime = "nodejs";

// Retorno de Webpay del asistente EMBEBIBLE. Multi-tenant vía ?t=<id>: el commit
// se hace con las credenciales del MISMO tenant que creó la transacción (la plata
// va a su cuenta) y se actualiza SU pedido. Como el comprador no está en una
// página de HarayaDev, renderizamos una confirmación mínima autocontenida.

function page(title: string, body: string, ok: boolean): Response {
  const color = ok ? "#1DAB61" : "#E62E2E";
  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title>
<style>body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#f5f6f8;margin:0;
display:flex;min-height:100vh;align-items:center;justify-content:center;padding:24px}
.card{background:#fff;border-radius:16px;box-shadow:0 8px 30px rgba(0,0,0,.12);padding:36px 32px;max-width:420px;text-align:center}
h1{font-size:22px;margin:0 0 10px;color:${color}}p{color:#444;line-height:1.6;margin:0}</style></head>
<body><div class="card"><h1>${title}</h1><p>${body}</p></div></body></html>`;
  return new Response(html, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

async function handle(params: URLSearchParams, tenantId: string | null): Promise<Response> {
  const tenant = getEmbedTenant(tenantId);
  if (!tenant) return page("Pedido no encontrado", "No pudimos identificar el negocio de este pago.", false);

  const tokenWs = params.get("token_ws");
  const tbkOrder = params.get("TBK_ORDEN_COMPRA");

  if (tokenWs && !params.get("TBK_TOKEN")) {
    try {
      const result = await commitTransaction(tokenWs, embedWebpayEnv(tenant));
      if (isApproved(result)) {
        await setOrderStatus(tenant.id, result.buy_order, "pagado", result.authorization_code);
        return page(
          "¡Pago confirmado!",
          `Tu pedido ${result.buy_order} en ${tenant.businessName} quedó pagado. ${
            tenant.whatsapp ? `Cualquier duda, escríbenos al +${tenant.whatsapp}.` : ""
          }`,
          true
        );
      }
      await setOrderStatus(tenant.id, result.buy_order, "rechazado");
      return page("Pago rechazado", "El pago no se completó. Puedes intentar de nuevo desde el asistente.", false);
    } catch (e) {
      console.error("[embed checkout] Webpay commit:", e);
      return page("No pudimos confirmar el pago", "Intenta de nuevo en unos minutos.", false);
    }
  }

  // Anulación por el usuario o timeout del formulario de pago.
  if (tbkOrder) await setOrderStatus(tenant.id, tbkOrder, "rechazado");
  return page("Pago anulado", "El pago se anuló. Puedes volver a intentarlo desde el asistente.", false);
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  return handle(url.searchParams, url.searchParams.get("t"));
}

export async function POST(req: Request) {
  const url = new URL(req.url);
  const form = await req.formData().catch(() => null);
  const params = new URLSearchParams();
  form?.forEach((value, key) => {
    if (typeof value === "string") params.set(key, value);
  });
  return handle(params, url.searchParams.get("t"));
}
