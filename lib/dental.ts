// Numeración FDI (11-48, los 32 dientes permanentes) y estados de diente —
// SIN ninguna dependencia de servidor (nada de lib/db.ts). components/agenda/
// AdminAgenda.tsx ("use client") necesita FDI_TEETH como valor real en el
// navegador para pintar la grilla; importarlo desde lib/booking-store.ts
// arrastra todo ese módulo (incluido postgres) al bundle del cliente y
// revienta el build ("Module not found: net/tls/fs/perf_hooks") — visto en
// vivo al probar esto. lib/booking-store.ts importa de acá, nunca al revés.
export type ToothCondition =
  | "sano"
  | "caries"
  | "obturado"
  | "corona"
  | "endodoncia"
  | "implante"
  | "ausente"
  | "extraccion_indicada";

export const FDI_TEETH = [
  ...[18, 17, 16, 15, 14, 13, 12, 11], // cuadrante 1: superior derecho
  ...[21, 22, 23, 24, 25, 26, 27, 28], // cuadrante 2: superior izquierdo
  ...[48, 47, 46, 45, 44, 43, 42, 41], // cuadrante 4: inferior derecho
  ...[31, 32, 33, 34, 35, 36, 37, 38], // cuadrante 3: inferior izquierdo
].map(String);

// Periodontograma reducido a lo que se usa a diario en una clínica boutique
// general (a propósito se deja fuera recesión gingival y compromiso de
// furca — se pueden sumar después sin romper nada, es JSONB flexible en
// Postgres). 3 puntos por cara (mesial/medio/distal) es el estándar de
// sondaje simplificado; "lingual" es palatino en dientes superiores y
// lingual en inferiores — un solo campo alcanza, la cara ya lo distingue
// visualmente en la UI según el diente.
export interface PeriodontalMeasurement {
  vestibular: [number, number, number]; // mm, mesial/medio/distal
  lingual: [number, number, number]; // mm, mesial/medio/distal
  bleedingVestibular: [boolean, boolean, boolean];
  bleedingLingual: [boolean, boolean, boolean];
  mobility: 0 | 1 | 2 | 3;
}
// Clave = número FDI, igual que Odontogram.teeth — un diente ausente del
// mapa se interpreta como "sin medir", no como sano (a diferencia del
// odontograma, acá no hay un valor por defecto clínicamente correcto).
export type PeriodontogramTeeth = Record<string, PeriodontalMeasurement>;
