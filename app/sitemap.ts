import type { MetadataRoute } from "next";
import { BRAND_PAGES, FIESTAS_PAGE, brandPagePath } from "@/lib/mandagroup-pages";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return [
    // "daily": la home cambia sola con cada fecha nueva en Vesti.
    { url: base, lastModified: new Date(), changeFrequency: "daily", priority: 1 },
    { url: `${base}${FIESTAS_PAGE.path}`, lastModified: new Date(), changeFrequency: "daily", priority: 0.9 },
    // Página de cada marca: lo que se busca por rubro (parrilla, sushi, club).
    ...BRAND_PAGES.map((p) => ({ url: `${base}${brandPagePath(p)}`, changeFrequency: "weekly" as const, priority: 0.8 })),
    { url: `${base}/carta`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/privacidad`, changeFrequency: "yearly", priority: 0.2 },
  ];
}
