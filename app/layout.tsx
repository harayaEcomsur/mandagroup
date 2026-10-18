import type { Metadata } from "next";
import { clientConfig } from "@/config/client.config";
import { getFontVariables } from "@/lib/fonts";
import { paletteToCssVars } from "@/lib/theme";
import { buildMetadata, buildLocalBusinessJsonLd } from "@/lib/seo";
import { MetaPixel } from "@/components/analytics/MetaPixel";
import { GoogleAnalytics } from "@/components/analytics/GoogleAnalytics";
import "./globals.css";

export const metadata: Metadata = buildMetadata(clientConfig);

// Opcionales: sin ninguna variable el sitio no carga nada de Meta (ver
// MetaPixel). El general recibe todo; el de cada marca, sus visitas y las
// acciones de esa marca (lib/mandagroup-pixel).
const metaPixels = {
  group: process.env.NEXT_PUBLIC_META_PIXEL_ID || undefined,
  brands: {
    renaca: process.env.NEXT_PUBLIC_META_PIXEL_RENACA || undefined,
    vina: process.env.NEXT_PUBLIC_META_PIXEL_VINA || undefined,
    carbon: process.env.NEXT_PUBLIC_META_PIXEL_CARBON || undefined,
    costa: process.env.NEXT_PUBLIC_META_PIXEL_COSTA || undefined,
  },
};
// Google Analytics 4 (opcional, ver components/analytics/GoogleAnalytics).
const gaId = process.env.NEXT_PUBLIC_GA_ID || undefined;
const hasMetaPixel = Boolean(metaPixels.group || Object.values(metaPixels.brands).some(Boolean));

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const fontVariables = getFontVariables(clientConfig.branding.fontPairing);
  const jsonLd = buildLocalBusinessJsonLd(clientConfig);

  return (
    <html
      lang={clientConfig.meta.locale}
      className={fontVariables}
      // El sitio es de tema oscuro (fondo casi negro); sin esto, Safari/Chrome
      // móvil renderizan inputs y otros controles nativos con su chrome claro
      // por defecto — fondo blanco con texto que hereda el color claro de la
      // página, prácticamente invisible.
      style={{ colorScheme: "dark", ...paletteToCssVars(clientConfig.branding.palette) }}
    >
      <body>
        {children}
        {gaId && <GoogleAnalytics id={gaId} />}
        {hasMetaPixel && <MetaPixel pixels={metaPixels} />}
        {!clientConfig.seo.jsonLdInPage && (
          <script
            type="application/ld+json"
            // eslint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
          />
        )}
      </body>
    </html>
  );
}
