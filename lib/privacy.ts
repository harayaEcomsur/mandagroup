import { clientConfig } from "@/config/client.config";

// Plazos de retención (Ley 21.719, vigencia 1-dic-2026). La ley NO fija un
// número único para todos los datos — exige guardar "solo lo necesario para
// el fin declarado", documentado en la política de privacidad y el registro
// de tratamiento (ver docs/registro-actividades-tratamiento.md). Estos son
// los plazos propios que documentamos y aplicamos, elegidos así:
//
// - bookings/leads/chatLogs/waThreads: ligados al ciclo de vida del servicio
//   o la prospección — no hay razón de negocio para guardarlos indefinidamente.
// - orders/realEstateContracts: 72 meses (6 años), alineado a la guarda de
//   documentación comercial/tributaria del Código de Comercio — un criterio
//   MÁS exigente que la 21.719, pero es el que ya rige por otra ley.
// - realEstateDeliveries: 60 meses (5 años), ventana habitual de prescripción
//   de acciones civiles en Chile — respaldo ante un reclamo de arriendo.
//
// Cada cliente puede ajustarlos en client.config.ts → privacy.retentionMonths
// si su rubro exige otra cosa (ej. salud tiene sus propios plazos legales de
// guarda de fichas). Ver lib/privacy-store.ts para la purga real.
export const DEFAULT_RETENTION_MONTHS = {
  bookings: 24,
  leads: 12,
  chatLogs: 6,
  waThreads: 12,
  orders: 72,
  realEstateDeliveries: 60,
  realEstateContracts: 72,
} as const;

export type RetentionKey = keyof typeof DEFAULT_RETENTION_MONTHS;

export function retentionMonths(key: RetentionKey): number {
  return clientConfig.privacy?.retentionMonths?.[key] ?? DEFAULT_RETENTION_MONTHS[key];
}

export function cutoffDate(months: number): Date {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return d;
}

export function arcoEmail(): string | undefined {
  return clientConfig.privacy?.arcoEmail ?? clientConfig.contact.email;
}
