import Image from "next/image";
import Link from "next/link";
import { BedDouble, Bath, Ruler, Car } from "lucide-react";
import type { ClientConfig } from "@/config/schema";

export type Property = NonNullable<ClientConfig["properties"]>[number];

export const OPERATION_LABEL: Record<Property["operation"], string> = {
  venta: "Venta",
  arriendo: "Arriendo",
  arriendo_temporada: "Arriendo temporada",
};

export function PropertyCard({ property }: { property: Property }) {
  return (
    <Link href={`/propiedades/${property.slug}`} className="group block">
      <div className="relative aspect-[4/3] overflow-hidden">
        <Image
          src={property.images[0]}
          alt={property.title}
          fill
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <span className="absolute left-3 top-3 bg-primary px-3 py-1 text-xs font-semibold uppercase tracking-wider text-white">
          {OPERATION_LABEL[property.operation]}
        </span>
        {property.video && (
          <span className="absolute right-3 top-3 bg-black/70 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-white">
            ▶ Video
          </span>
        )}
      </div>
      <div className="border-b border-foreground/15 pb-4 pt-3">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="font-heading text-base font-semibold text-foreground group-hover:text-primary">
            {property.title}
          </h3>
          <span className="shrink-0 font-heading text-base font-bold text-primary">{property.price}</span>
        </div>
        <p className="mt-1 text-xs font-medium uppercase tracking-wider text-foreground/60">{property.comuna}</p>
        <div className="mt-2 flex flex-wrap gap-4 text-xs text-foreground/70">
          {property.bedrooms != null && (
            <span className="flex items-center gap-1"><BedDouble size={14} /> {property.bedrooms}D</span>
          )}
          {property.bathrooms != null && (
            <span className="flex items-center gap-1"><Bath size={14} /> {property.bathrooms}B</span>
          )}
          {property.area != null && (
            <span className="flex items-center gap-1"><Ruler size={14} /> {property.area} m²</span>
          )}
          {property.parking != null && property.parking > 0 && (
            <span className="flex items-center gap-1"><Car size={14} /> {property.parking}</span>
          )}
        </div>
      </div>
    </Link>
  );
}
