import * as icons from "lucide-react";
import { CircleDot, type LucideProps } from "lucide-react";

// Resuelve cualquier ícono de lucide-react por nombre (ej. "Scissors", "UtensilsCrossed").
// Así el schema no depende de una lista fija de íconos: sirve para cualquier rubro.
export function Icon({ name, ...props }: { name: string } & LucideProps) {
  const iconMap = icons as unknown as Record<string, React.ComponentType<LucideProps>>;
  const Resolved = iconMap[name] ?? CircleDot;
  return <Resolved {...props} />;
}
