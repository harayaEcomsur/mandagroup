import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import { listCartas, type Carta } from "@/lib/mandagroup-catalog";
import { listActiveEvents } from "@/lib/mandagroup-store";
import { CARTA_VENUE, pickCartaPromos, toPromoItem } from "@/lib/mandagroup-carta-promos";
import { CartaReader } from "@/components/mandagroup/CartaReader";
import { CartaPromo } from "@/components/mandagroup/CartaPromo";
import { EventCard } from "@/components/mandagroup/EventCard";
import { PdfViewer } from "@/components/mandagroup/PdfViewer";

// Una carta a pantalla completa: adonde llevan los botones "Ver carta" del
// inicio en el celular (QR de las mesas de Manda). Sin el header del sitio,
// para que la carta use toda la pantalla; zoom en la barra, aviso de próximas
// fechas abajo (CartaPromo) y las mismas fechas al final.

export const revalidate = 300;

async function findCarta(id: string): Promise<{ carta: Carta; cartas: Carta[] } | null> {
  const cartas = await listCartas();
  const carta = cartas.find((c) => c.id === id && c.showOnSite && c.source.type === "file");
  return carta ? { carta, cartas } : null;
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const found = await findCarta(params.id);
  if (!found) return {};
  const { carta } = found;
  return {
    title: `${carta.title} | Manda Group`,
    description: carta.description ? `${carta.title}: ${carta.description}` : `${carta.title}. Mírala en el celular o descárgala en PDF.`,
    alternates: { canonical: `/carta/${carta.id}` },
  };
}

export default async function CartaReaderPage({ params }: { params: { id: string } }) {
  const [found, events] = await Promise.all([findCarta(params.id), listActiveEvents()]);
  if (!found) notFound();
  const { carta, cartas } = found;
  if (carta.source.type !== "file") notFound();
  const { source } = carta;

  // Reñaca ⇄ Viña: las otras cartas de la misma marca que se leen aquí.
  const siblings =
    carta.brand === "manda"
      ? cartas
          .filter((c) => c.brand === "manda" && c.showOnSite && c.source.type === "file")
          .map((c) => ({ id: c.id, label: c.title.replace(/^Carta Manda\s*/i, "").replace(/ del Mar$/, "") || c.title, active: c.id === carta.id }))
      : [];

  const venue = CARTA_VENUE[carta.id];
  const promos = pickCartaPromos(events, venue);
  const heading = venue ? "Próximo en Manda" : "Próximo en Manda Group";

  return (
    <main className="min-h-dvh pb-28">
      {source.pages?.length ? (
        <CartaReader title={carta.title} pages={source.pages} pdfUrl={source.url} siblings={siblings} />
      ) : (
        <div className="mx-auto max-w-3xl px-4 pt-6">
          <h1 className="font-heading text-2xl font-semibold text-foreground">{carta.title}</h1>
          <div className="mt-6">
            <PdfViewer url={source.url} title={carta.title} />
          </div>
        </div>
      )}

      {promos.length > 0 && (
        <section className="mx-auto mt-16 max-w-3xl px-4" aria-labelledby="carta-fechas">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Después de la carta</p>
          <h2 id="carta-fechas" className="mt-2 font-heading text-2xl font-semibold tracking-tight text-foreground">
            Lo que viene en Manda Group
          </h2>
          <div className="mt-6 grid gap-8 sm:grid-cols-3">
            {promos.map((e) => (
              <EventCard key={e.id} event={e} />
            ))}
          </div>
          <Link
            href="/#eventos"
            className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-primary hover:text-accent"
          >
            Ver toda la cartelera
            <ArrowUpRight size={15} strokeWidth={2} />
          </Link>
        </section>
      )}

      <p className="mx-auto mt-14 max-w-3xl px-4 text-sm text-foreground/50">
        <Link href="/carta" className="underline underline-offset-4 hover:text-foreground">
          Otras cartas del grupo
        </Link>{" "}
        ·{" "}
        <Link href="/" className="underline underline-offset-4 hover:text-foreground">
          Manda Group
        </Link>
      </p>

      <CartaPromo items={promos.map(toPromoItem)} heading={heading} />
    </main>
  );
}
