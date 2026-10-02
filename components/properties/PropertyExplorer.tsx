"use client";

import { useMemo, useState } from "react";
import { PropertyCard, OPERATION_LABEL, type Property } from "@/components/properties/PropertyCard";

// Búsqueda y filtrado client-side sobre el inventario. Con inventarios de pyme
// (decenas de propiedades) no se necesita backend: filtra al instante.
export function PropertyExplorer({ properties }: { properties: Property[] }) {
  const [operation, setOperation] = useState<string>("todas");
  const [type, setType] = useState<string>("todos");
  const [comuna, setComuna] = useState<string>("todas");
  const [minBedrooms, setMinBedrooms] = useState<number>(0);

  const comunas = useMemo(() => [...new Set(properties.map((p) => p.comuna))].sort(), [properties]);
  const types = useMemo(() => [...new Set(properties.map((p) => p.type))].sort(), [properties]);

  const filtered = properties.filter(
    (p) =>
      (operation === "todas" || p.operation === operation) &&
      (type === "todos" || p.type === type) &&
      (comuna === "todas" || p.comuna === comuna) &&
      (minBedrooms === 0 || (p.bedrooms ?? 0) >= minBedrooms)
  );

  const selectCls =
    "border border-foreground/20 bg-background px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary";

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap">
        <select value={operation} onChange={(e) => setOperation(e.target.value)} className={selectCls} aria-label="Operación">
          <option value="todas">Comprar o arrendar</option>
          {Object.entries(OPERATION_LABEL).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <select value={type} onChange={(e) => setType(e.target.value)} className={selectCls} aria-label="Tipo de propiedad">
          <option value="todos">Todos los tipos</option>
          {types.map((t) => (
            <option key={t} value={t}>{t[0].toUpperCase() + t.slice(1)}</option>
          ))}
        </select>
        <select value={comuna} onChange={(e) => setComuna(e.target.value)} className={selectCls} aria-label="Comuna">
          <option value="todas">Todas las comunas</option>
          {comunas.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select
          value={minBedrooms}
          onChange={(e) => setMinBedrooms(Number(e.target.value))}
          className={selectCls}
          aria-label="Dormitorios mínimos"
        >
          <option value={0}>Dormitorios: todos</option>
          {[1, 2, 3, 4].map((n) => (
            <option key={n} value={n}>{n}+ dormitorios</option>
          ))}
        </select>
      </div>

      <p className="mt-6 text-xs font-medium uppercase tracking-wider text-foreground/50">
        {filtered.length} {filtered.length === 1 ? "propiedad" : "propiedades"}
      </p>

      {filtered.length ? (
        <div className="mt-4 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => (
            <PropertyCard key={p.slug} property={p} />
          ))}
        </div>
      ) : (
        <p className="mt-8 text-foreground/60">
          No hay propiedades con esos filtros — prueba ampliando la búsqueda o escríbenos: tenemos
          propiedades que aún no publicamos.
        </p>
      )}
    </div>
  );
}
