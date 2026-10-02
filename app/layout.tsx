import type { Metadata } from "next";
import { clientConfig } from "@/config/client.config";
import { getFontVariables } from "@/lib/fonts";
import { paletteToCssVars } from "@/lib/theme";
import { buildMetadata, buildLocalBusinessJsonLd } from "@/lib/seo";
import "./globals.css";

export const metadata: Metadata = buildMetadata(clientConfig);

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const fontVariables = getFontVariables(clientConfig.branding.fontPairing);
  const jsonLd = buildLocalBusinessJsonLd(clientConfig);

  return (
    <html
      lang={clientConfig.meta.locale}
      className={fontVariables}
      style={paletteToCssVars(clientConfig.branding.palette)}
    >
      <body>
        {children}
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </body>
    </html>
  );
}
