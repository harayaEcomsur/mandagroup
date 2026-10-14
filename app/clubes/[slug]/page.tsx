import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BrandPageShell, brandMetadata } from "@/components/mandagroup/BrandPageShell";
import { BRAND_PAGES, findBrandPage } from "@/lib/mandagroup-pages";

// Páginas de los clubes del grupo (Manda Reñaca, Manda Viña del Mar). Contenido en
// lib/mandagroup-pages; se regeneran con la cartelera y el panel.
export const revalidate = 600;
export const dynamicParams = false;

export function generateStaticParams() {
  return BRAND_PAGES.filter((p) => p.section === "clubes").map((p) => ({ slug: p.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const page = findBrandPage("clubes", params.slug);
  return page ? brandMetadata(page) : {};
}

export default function ClubPage({ params }: { params: { slug: string } }) {
  const page = findBrandPage("clubes", params.slug);
  if (!page) notFound();
  return <BrandPageShell page={page} />;
}
