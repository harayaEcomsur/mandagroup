import { commitTransaction, isApproved } from "@/lib/webpay";
import { setOrderResult } from "@/lib/order-store";

export const runtime = "nodejs";

// URL de retorno de Webpay. Transbank vuelve con:
//  - token_ws                → flujo normal: hay que confirmar (commit) la transacción
//  - TBK_TOKEN (+ TBK_ORDEN_COMPRA) → el usuario anuló el pago en el formulario
//  - solo TBK_ORDEN_COMPRA   → timeout del formulario de pago
// Puede llegar como GET (query) o POST (form), así que se aceptan ambos.

async function handle(params: URLSearchParams): Promise<Response> {
  const tokenWs = params.get("token_ws");
  const tbkToken = params.get("TBK_TOKEN");
  const tbkOrder = params.get("TBK_ORDEN_COMPRA");

  // La confirmación viaja también por query string: el store en memoria puede
  // vivir en otro isolate serverless, y la página de pedido no debe depender de él.
  const redirect = (orderId: string, query: Record<string, string>) => {
    const qs = new URLSearchParams(query).toString();
    return new Response(null, {
      status: 303,
      headers: { Location: `/tienda/pedido/${encodeURIComponent(orderId || "desconocido")}?${qs}` },
    });
  };

  if (tokenWs && !tbkToken) {
    try {
      const result = await commitTransaction(tokenWs);
      if (isApproved(result)) {
        const last4 = result.card_detail?.card_number?.slice(-4) ?? "";
        setOrderResult(result.buy_order, "pagada", {
          authorizationCode: result.authorization_code,
          cardLast4: last4,
        });
        return redirect(result.buy_order, {
          estado: "pagada",
          monto: String(result.amount),
          auth: result.authorization_code ?? "",
          card: last4,
        });
      }
      setOrderResult(result.buy_order, "rechazada");
      return redirect(result.buy_order, { estado: "rechazada" });
    } catch (e) {
      console.error("[checkout] Webpay commit:", e);
      return redirect(tbkOrder ?? "", { estado: "error" });
    }
  }

  // Anulación por el usuario o timeout del formulario de pago.
  if (tbkOrder) setOrderResult(tbkOrder, "anulada");
  return redirect(tbkOrder ?? "", { estado: "anulada" });
}

export async function GET(req: Request) {
  return handle(new URL(req.url).searchParams);
}

export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  const params = new URLSearchParams();
  form?.forEach((value, key) => {
    if (typeof value === "string") params.set(key, value);
  });
  return handle(params);
}
