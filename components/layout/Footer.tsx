import { Container } from "@/components/ui/Container";
import type { ClientConfig } from "@/config/schema";

export function Footer({ config }: { config: ClientConfig }) {
  const { meta, contact, branding } = config;
  // En las demos el crédito va siempre; en sitios de clientes solo si lo aprobaron.
  const mostrarCredito = branding.credit || Boolean(process.env.SITE_NOINDEX);

  return (
    <footer className="border-t border-black/5 py-10 text-sm text-foreground/60">
      <Container className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p>
          © {new Date().getFullYear()} {meta.businessName}. Todos los derechos reservados.
        </p>
        <div className="flex flex-wrap items-center gap-4">
          {contact.address && <span>{contact.address}</span>}
          {contact.phone && (
            <a href={`tel:${contact.phone}`} className="hover:text-primary">
              {contact.phone}
            </a>
          )}
          <a href="/privacidad" className="hover:text-primary">
            Política de privacidad
          </a>
          {mostrarCredito && (
            <a
              href="https://haraya.dev/como-lo-hicimos"
              target="_blank"
              rel="noopener"
              className="opacity-70 transition-opacity hover:opacity-100 hover:text-primary"
            >
              Sitio por HarayaDev
            </a>
          )}
        </div>
      </Container>
    </footer>
  );
}
