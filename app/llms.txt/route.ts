import { clientConfig } from "@/config/client.config";
import { listActiveEvents } from "@/lib/mandagroup-store";
import { BRANDS, buildFaq, eventVenueLabel } from "@/lib/mandagroup-brands";
import { listCartas, listLocales, reservationLink } from "@/lib/mandagroup-catalog";

// /llms.txt (llmstxt.org): resumen en Markdown para asistentes de IA
// (ChatGPT, Claude, Perplexity) — qué es Manda Group, sus marcas, dónde
// están, cómo se compran entradas y la cartelera vigente, sin tener que
// renderizar la página. Mismas fuentes que la home (lib/mandagroup-brands +
// listActiveEvents), así nunca dice algo distinto de lo que ve la gente.
export const revalidate = 900;

export async function GET() {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const [events, locales, cartas] = await Promise.all([listActiveEvents(), listLocales(), listCartas()]);

  const lines = [
    "# Manda Group",
    "",
    `> ${clientConfig.seo.description}`,
    "",
    "Manda Group es un grupo de vida nocturna y gastronomía en la costa de la Región de Valparaíso, Chile: clubes en Reñaca y Viña del Mar, y restaurantes en Valparaíso y Curauma.",
    "",
    "## Marcas",
    "",
    ...BRANDS.map(
      (b) =>
        `- **${b.name}**: ${b.kind}.${b.address ? ` Dirección: ${b.address}.` : ""} Instagram: https://www.instagram.com/${b.handle}/`
    ),
    "",
    "## Próximas fiestas",
    "",
    ...(events.length
      ? events.map((e) => `- ${e.eventDate} · ${e.title} (${eventVenueLabel(e)}): ${e.ticketUrl}`)
      : ["- No hay fechas a la venta en este momento."]),
    "",
    "## Preguntas frecuentes",
    "",
    ...buildFaq(locales).flatMap((f) => [`### ${f.q}`, "", f.a, ""]),
    "## Cartas",
    "",
    ...cartas.filter((c) => c.showOnSite).map((c) => `- [${c.title}](${/^https?:/.test(c.source.url) ? c.source.url : base + c.source.url})`),
    "",
    "## Enlaces",
    "",
    `- [Sitio](${base}/): cartelera, marcas y contacto`,
    ...locales
      .filter((l) => l.showOnSite && reservationLink(l))
      .map((l) => `- [Reservas ${l.name}](${reservationLink(l)!.href})`),
    clientConfig.contact.whatsapp ? `- [WhatsApp de consultas](https://wa.me/${clientConfig.contact.whatsapp})` : "",
    `- [Política de privacidad](${base}/privacidad)`,
  ];

  return new Response(lines.filter((l, i, a) => !(l === "" && a[i - 1] === "")).join("\n") + "\n", {
    headers: { "Content-Type": "text/markdown; charset=utf-8" },
  });
}
