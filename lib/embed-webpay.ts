import type { WebpayCreds } from "@/lib/webpay";
import type { EmbedTenant } from "@/config/embed-tenants";

// Credenciales PÚBLICAS del ambiente de integración de Transbank (las mismas que
// documenta Transbank y usa el módulo single-tenant). No cobran dinero real.
const INTEGRATION: WebpayCreds = {
  host: "https://webpay3gint.transbank.cl",
  commerceCode: "597055555532",
  apiKey: "579B532A7440BB0C9079DED94D31EA1615BACEB56610332264630D42D0A36B1C",
  production: false,
};

// Aislamiento de la PLATA por tenant: cada cliente cobra en SU cuenta de
// Transbank, no en la de HarayaDev. Los secretos viven SOLO en variables de
// entorno namespaced por tenant (nunca en el config, que es código versionado):
//
//   TBK_ENV_<ID>=produccion
//   TBK_COMMERCE_CODE_<ID>=<código de comercio del cliente>
//   TBK_API_KEY_<ID>=<llave secreta del cliente>
//
// donde <ID> es el tenantId en MAYÚSCULAS con lo no alfanumérico como "_"
// (ej. tenant "nails-color" → TBK_COMMERCE_CODE_NAILS_COLOR). Si el tenant no
// tiene credenciales propias configuradas, cae al AMBIENTE DE INTEGRACIÓN de
// Transbank (pago de prueba, no cobra dinero real) — perfecto para demos.

function envKey(tenantId: string, suffix: string): string {
  const norm = tenantId.toUpperCase().replace(/[^A-Z0-9]+/g, "_");
  return `${suffix}_${norm}`;
}

export function embedWebpayEnv(tenant: EmbedTenant): WebpayCreds {
  const env = process.env[envKey(tenant.id, "TBK_ENV")];
  const commerceCode = process.env[envKey(tenant.id, "TBK_COMMERCE_CODE")];
  const apiKey = process.env[envKey(tenant.id, "TBK_API_KEY")];

  if (env === "produccion") {
    if (!commerceCode || !apiKey) {
      throw new Error(
        `El tenant "${tenant.id}" tiene TBK_ENV_…=produccion pero le faltan TBK_COMMERCE_CODE_…/TBK_API_KEY_…`
      );
    }
    return { host: "https://webpay3g.transbank.cl", commerceCode, apiKey, production: true };
  }
  // Sin credenciales propias de producción: SIEMPRE integración. Nunca se cae al
  // TBK_ENV global — un tenant sin sus credenciales no debe cobrar a la cuenta de
  // HarayaDev ni de ningún otro comercio.
  return INTEGRATION;
}

// ¿El tenant cobra de verdad (tiene sus propias credenciales de producción)?
export function embedWebpayIsProduction(tenant: EmbedTenant): boolean {
  return process.env[envKey(tenant.id, "TBK_ENV")] === "produccion";
}
