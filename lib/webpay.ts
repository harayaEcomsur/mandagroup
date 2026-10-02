// Webpay Plus (Transbank) vía su API REST v1.2 — dos llamadas fetch, sin SDK.
//
// Por defecto corre contra el AMBIENTE DE INTEGRACIÓN de Transbank con sus
// credenciales públicas de prueba (documentadas por Transbank): el flujo de pago
// completo funciona pero no se cobra dinero real. Para pagar en la demo se usa la
// tarjeta de prueba VISA 4051 8856 0044 6623, CVV 123, cualquier fecha de
// expiración; en el formulario de "banco" de prueba: RUT 11.111.111-1, clave 123.
//
// Producción (cuando el comercio tiene su código validado por Transbank):
//   TBK_ENV=produccion  TBK_COMMERCE_CODE=<código comercio>  TBK_API_KEY=<llave secreta>

const INTEGRATION = {
  host: "https://webpay3gint.transbank.cl",
  commerceCode: "597055555532",
  apiKey: "579B532A7440BB0C9079DED94D31EA1615BACEB56610332264630D42D0A36B1C",
};

export interface WebpayCreds {
  host: string;
  commerceCode: string;
  apiKey: string;
  production: boolean;
}

export function webpayEnv(): WebpayCreds {
  if (process.env.TBK_ENV === "produccion") {
    const commerceCode = process.env.TBK_COMMERCE_CODE;
    const apiKey = process.env.TBK_API_KEY;
    if (!commerceCode || !apiKey) {
      throw new Error("TBK_ENV=produccion requiere TBK_COMMERCE_CODE y TBK_API_KEY");
    }
    return { host: "https://webpay3g.transbank.cl", commerceCode, apiKey, production: true };
  }
  return { ...INTEGRATION, production: false };
}

// creds opcional: el single-tenant usa webpayEnv() (comportamiento intacto); el
// asistente embebible pasa las credenciales del tenant (aislamiento de la plata
// por cliente — ver lib/embed-webpay.ts).
async function tbkFetch(path: string, init: RequestInit, creds: WebpayCreds = webpayEnv()): Promise<Response> {
  const { host, commerceCode, apiKey } = creds;
  return fetch(`${host}/rswebpaytransaction/api/webpay/v1.2${path}`, {
    ...init,
    headers: {
      "Tbk-Api-Key-Id": commerceCode,
      "Tbk-Api-Key-Secret": apiKey,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
}

export async function createTransaction(
  args: {
    buyOrder: string;
    sessionId: string;
    amount: number;
    returnUrl: string;
  },
  creds?: WebpayCreds
): Promise<{ token: string; url: string }> {
  const res = await tbkFetch(
    "/transactions",
    {
      method: "POST",
      body: JSON.stringify({
        buy_order: args.buyOrder,
        session_id: args.sessionId,
        amount: args.amount,
        return_url: args.returnUrl,
      }),
    },
    creds ?? webpayEnv()
  );
  if (!res.ok) {
    throw new Error(`Webpay create falló (${res.status}): ${await res.text().catch(() => "")}`);
  }
  return (await res.json()) as { token: string; url: string };
}

export interface CommitResult {
  status: string;
  response_code: number;
  buy_order: string;
  amount: number;
  authorization_code?: string;
  payment_type_code?: string;
  transaction_date?: string;
  card_detail?: { card_number?: string };
}

export async function commitTransaction(token: string, creds?: WebpayCreds): Promise<CommitResult> {
  const res = await tbkFetch(`/transactions/${token}`, { method: "PUT" }, creds ?? webpayEnv());
  if (!res.ok) {
    throw new Error(`Webpay commit falló (${res.status}): ${await res.text().catch(() => "")}`);
  }
  return (await res.json()) as CommitResult;
}

export function isApproved(r: CommitResult): boolean {
  return r.response_code === 0 && r.status === "AUTHORIZED";
}
