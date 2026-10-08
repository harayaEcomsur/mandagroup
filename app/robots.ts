import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return {
    // Todo el contenido público abierto, incluidos los bots de búsqueda con
    // IA (GPTBot, ClaudeBot, PerplexityBot, Google-Extended): bloquearlos
    // impide que ChatGPT/Claude/Perplexity citen el sitio. Solo se cierran
    // paneles internos y endpoints.
    rules: {
      userAgent: "*",
      allow: "/",
      // Las páginas de QR y los PDFs de cartas NO van acá a propósito: si se
      // bloquea el rastreo, Google no ve su "noindex" (X-Robots-Tag en
      // next.config) y podría listar la URL igual si alguien la enlaza.
      disallow: ["/api/", "/eventos/admin", "/agenda/admin", "/tienda/admin", "/inmobiliaria/admin", "/embed/", "/variantes"],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
