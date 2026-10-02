import { z } from "zod";
import { clientConfig } from "@/config/client.config";
import { getBooking } from "@/lib/booking-store";
import { createTransaction } from "@/lib/webpay";

export const runtime = "nodejs";

// Inicia el pago del abono de una reserva con Webpay. Requiere que el config
// defina booking.depositAmount; el monto NUNCA viene del cliente.

const schema = z.object({ id: z.string().min(4).max(12) });

export async function POST(req: Request) {
  const depositAmount = clientConfig.booking?.depositAmount;
  if (!clientConfig.modules.agenda || !depositAmount) {
    return Response.json({ error: "El pago de abono online no está habilitado." }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Datos inválidos" }, { status: 400 });

  const booking = await getBooking(parsed.data.id);
  if (!booking) return Response.json({ error: "Reserva no encontrada." }, { status: 404 });
  if (booking.status === "cancelada") {
    return Response.json({ error: "Esa reserva está cancelada." }, { status: 409 });
  }
  if (booking.status === "pendiente_autorizacion") {
    return Response.json(
      { error: "Esta reserva supera el cupo diario y está pendiente de autorización del negocio antes de pagar el abono." },
      { status: 409 }
    );
  }
  if (booking.payment) {
    return Response.json({ error: "El abono de esa reserva ya está pagado." }, { status: 409 });
  }

  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(req.url).origin;
  try {
    const tx = await createTransaction({
      // Prefijo "A" para distinguirlo de los pedidos de la tienda en Webpay.
      buyOrder: `A${booking.id}`,
      sessionId: booking.id,
      amount: depositAmount,
      returnUrl: `${origin}/api/agenda/abono/retorno`,
    });
    return Response.json({ url: tx.url, token: tx.token });
  } catch (e) {
    console.error("[agenda] Webpay create abono:", e);
    return Response.json(
      { error: "No pudimos conectar con Webpay. Intenta de nuevo en unos minutos." },
      { status: 502 }
    );
  }
}
