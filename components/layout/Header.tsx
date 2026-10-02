"use client";

import { useState } from "react";
import { Menu, X } from "lucide-react";
import { Container } from "@/components/ui/Container";
import type { ClientConfig } from "@/config/schema";

export function Header({ config }: { config: ClientConfig }) {
  const [open, setOpen] = useState(false);
  const { branding, meta, modules } = config;

  const links = [
    modules.propiedades && { href: "/propiedades", label: "Propiedades" },
    modules.agenda && { href: "/agenda", label: "Agendar" },
    modules.tienda && { href: "/tienda", label: "Tienda" },
    { href: "/#servicios", label: "Servicios" },
    { href: "/#nosotros", label: "Nosotros" },
    modules.pricing && { href: "/#precios", label: "Precios" },
    { href: "/#contacto", label: "Contacto" },
  ].filter(Boolean) as { href: string; label: string }[];

  return (
    <header className="sticky top-0 z-30 border-b border-black/5 bg-background/90 backdrop-blur">
      <Container className="flex h-20 items-center justify-between sm:h-24">
        {/* El logo es la marca del cliente: va grande (2-3x el título), y el
            nombre en texto pasa a acompañarlo en chico. */}
        <a href="/" className="flex min-w-0 items-center gap-3" onClick={() => setOpen(false)}>
          {/* eslint-disable-next-line @next/next/no-img-element -- logo is a local SVG; next/image requires dangerouslyAllowSVG for those */}
          <img
            src={branding.logoUrl}
            alt={meta.businessName}
            className="h-12 w-auto max-w-[170px] rounded-md object-contain sm:h-[4.5rem] sm:max-w-[280px]"
          />
          {/* En móvil el nombre siempre acompaña al logo (el logo se achica y
              puede no leerse); en desktop se omite solo si el logo ya lo trae. */}
          <span
            className={`truncate font-heading text-sm font-medium text-foreground/80 ${
              branding.logoIncludesName ? "md:hidden" : ""
            }`}
          >
            {meta.businessName}
          </span>
        </a>
        <nav className="hidden gap-6 text-sm font-medium text-foreground/70 sm:flex">
          {links.map((link) => (
            <a key={link.href} href={link.href} className="hover:text-primary">
              {link.label}
            </a>
          ))}
        </nav>
        <button
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Cerrar menú" : "Abrir menú"}
          aria-expanded={open}
          className="-m-2 p-2 text-foreground sm:hidden"
        >
          {open ? <X size={26} /> : <Menu size={26} />}
        </button>
      </Container>
      {open && (
        <nav className="border-t border-black/5 bg-background sm:hidden">
          <Container className="flex flex-col py-2">
            {links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="border-b border-black/5 py-3.5 text-base font-medium text-foreground/80 last:border-b-0 hover:text-primary"
              >
                {link.label}
              </a>
            ))}
          </Container>
        </nav>
      )}
    </header>
  );
}
