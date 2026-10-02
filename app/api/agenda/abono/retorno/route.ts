import { commitTransaction, isApproved } from "@/lib/webpay";
import { setBookingPaid } from "@/lib/booking-store";

export const runtime = "nodejs";

// URL de retorno de Webpay para el abono de la agenda. Mismo contrato que el
// retorno de la tienda: token_ws = confirmar; TBK_TOKEN = anulado; solo
// TBK_ORDEN_COMPRA = timeout. El buy_order del abono viene con prefijo "A".

function bookingIdFromBuyOrder(buyOrder: string | null): string {
  if (!buyOrder) return "";
  return buyOrder.startsWith("A") ? buyOrder.slice(1) : buyOrder;
}

async function handle(params: URLSearchParams): Promise<Response> {
  const tokenWs = params.get("token_ws");
  const tbkToken = params.get("TBK_TOKEN");
  const tbkOrder = params.get("TBK_ORDEN_COMPRA");

  const redirect = (bookingId: string, query: Record<string, string>) => {
    const qs = new URLSearchParams(query).toString();
    return new Response(null, {
      status: 303,
      headers: { Location: `/agenda/abono/${encodeURIComponent(bookingId || "desconocida")}?${qs}` },
    });
  };

  if (tokenWs && !tbkToken) {
    try {
      const result = await commitTransaction(tokenWs);
      const bookingId = bookingIdFromBuyOrder(result.buy_order);
      if (isApproved(result)) {
        const last4 = result.card_detail?.card_number?.slice(-4) ?? "";
        await setBookingPaid(bookingId, {
          amount: result.amount,
          authorizationCode: result.authorization_code,
          cardLast4: last4,
        });
        return redirect(bookingId, {
          estado: "pagada",
          monto: String(result.amount),
          auth: result.authorization_code ?? "",
          card: last4,
        });
      }
      return redirect(bookingId, { estado: "rechazada" });
    } catch (e) {
      console.error("[agenda] Webpay commit abono:", e);
      return redirect(bookingIdFromBuyOrder(tbkOrder), { estado: "error" });
    }
  }

  // Anulado por el usuario o timeout: la reserva sigue pendiente de abono.
  return redirect(bookingIdFromBuyOrder(tbkOrder), { estado: "anulada" });
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
