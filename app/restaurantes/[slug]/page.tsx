import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BrandPageShell, brandMetadata } from "@/components/mandagroup/BrandPageShell";
import { BRAND_PAGES, findBrandPage } from "@/lib/mandagroup-pages";

// Páginas de los restaurantes del grupo (Carbón, Costa Sushi). Contenido en
// lib/mandagroup-pages; se regeneran con la cartelera y el panel.
export const revalidate = 600;
export const dynamicParams = false;

export function generateStaticParams() {
  return BRAND_PAGES.filter((p) => p.section === "restaurantes").map((p) => ({ slug: p.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const page = findBrandPage("restaurantes", params.slug);
  return page ? brandMetadata(page) : {};
}

export default function RestaurantePage({ params }: { params: { slug: string } }) {
  const page = findBrandPage("restaurantes", params.slug);
  if (!page) notFound();
  return <BrandPageShell page={page} />;
}
