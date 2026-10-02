import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { clientConfig } from "@/config/client.config";
import { paletteToCssVars } from "@/lib/theme";
import { HomeContent } from "@/components/HomeContent";

// Renderiza la home completa con la paleta de una variante. Las variables CSS
// del wrapper pisan las del <html> (lib/theme.ts), así que todos los
// componentes se re-tiñen sin tocar el build.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export function generateStaticParams() {
  return (clientConfig.themeVariants ?? []).map((v) => ({ id: v.id }));
}

export default function VariantePage({ params }: { params: { id: string } }) {
  const variant = clientConfig.themeVariants?.find((v) => v.id === params.id);
  if (!variant) notFound();

  return (
    <div style={paletteToCssVars(variant.palette)} className="min-h-screen bg-background text-foreground">
      <HomeContent />
    </div>
  );
}
