import { Container } from "@/components/ui/Container";
import type { ClientConfig } from "@/config/schema";

export function Footer({ config }: { config: ClientConfig }) {
  const { meta, contact, branding } = config;
  // En las demos el crédito va siempre; en sitios de clientes solo si lo aprobaron.
  const mostrarCredito = branding.credit || Boolean(process.env.SITE_NOINDEX);

  return (
    // pb-28 en móvil y pr-24 desde sm: dejan libre la esquina inferior
    // derecha, donde flotan los botones de WhatsApp y del chat — sin esto
    // tapaban justo lo último del footer (el crédito).
    <footer className="border-t border-foreground/10 pb-28 pt-10 text-sm text-foreground/60 sm:pb-10">
      <Container className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:pr-24 lg:pr-24">
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
              className="font-medium text-foreground/70 transition-colors hover:text-primary"
            >
              Sitio por HarayaDev
            </a>
          )}
        </div>
      </Container>
    </footer>
  );
}
