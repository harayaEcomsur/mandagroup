// Vocabulario del panel /agenda/admin: cada rubro le llama distinto a lo
// mismo (barbero vs. profesional de la salud, paciente vs. cliente). Sin
// dependencias de servidor a propósito — mismo motivo que lib/dental.ts, para
// que sea seguro importarlo desde cualquier lado sin arrastrar nada pesado al
// bundle del cliente.

export interface Vocabulary {
  professionalSingular: string;
  professionalPlural: string;
  // Copy de ejemplo en la sección "Profesionales" (ej. "barberos, peluqueras").
  professionalExamples: string;
  clientSingular: string;
  clientPlural: string;
  bookingSingular: string;
  bookingPlural: string;
  // "Nombre del insumo" en Gastos → Inventario.
  supplyItemSingular: string;
}

// Exactamente el copy que ya existía hardcodeado en AdminAgenda.tsx — ningún
// cliente existente cambia visualmente a menos que le agreguemos `vocabulary`
// a su config.
export const DEFAULT_VOCABULARY: Vocabulary = {
  professionalSingular: "Profesional",
  professionalPlural: "Profesionales",
  professionalExamples: "barberos, peluqueras, manicuristas",
  clientSingular: "cliente",
  clientPlural: "Clientes",
  bookingSingular: "reserva",
  bookingPlural: "Reservas",
  supplyItemSingular: "insumo",
};

// `overrides` puede traer solo algunos campos (ej. solo clientPlural:
// "Pacientes") — el resto cae al default.
export function resolveVocabulary(overrides?: Partial<Vocabulary>): Vocabulary {
  return { ...DEFAULT_VOCABULARY, ...overrides };
}
