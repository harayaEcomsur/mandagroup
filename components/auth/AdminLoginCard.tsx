import { GoogleLoginButton } from "@/components/auth/GoogleLoginButton";
import { PasswordLoginForm } from "@/components/auth/PasswordLoginForm";
import { ClaveLoginForm } from "@/components/auth/ClaveLoginForm";

// Pantalla de login del panel — reemplaza el viejo párrafo + <code>?clave=…</code>
// por una tarjeta con la marca real del negocio. Server component: usa las
// variables CSS de la paleta (--color-primary, etc.) que ya son globales vía
// app/layout.tsx, así que no hace falta pasarle la paleta como prop.
// Escrita genérica a propósito (nada de "/agenda/admin" hardcodeado) para que
// tienda/inmobiliaria puedan reusarla más adelante sin reescribirla.
export function AdminLoginCard({
  businessName,
  logoUrl,
  description,
  googleEnabled,
  passwordEnabled,
  claveEnabled,
  claveEndpoint = "/api/auth/clave",
}: {
  businessName: string;
  logoUrl: string;
  description?: string;
  googleEnabled: boolean;
  passwordEnabled?: boolean;
  claveEnabled: boolean;
  claveEndpoint?: string;
}) {
  const methods = [googleEnabled, passwordEnabled, claveEnabled].filter(Boolean).length;
  let shown = 0;

  function divider() {
    shown++;
    return shown < methods ? (
      <div className="flex w-full items-center gap-3 text-xs uppercase tracking-wider text-foreground/40">
        <span className="h-px flex-1 bg-foreground/10" /> o <span className="h-px flex-1 bg-foreground/10" />
      </div>
    ) : null;
  }

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col items-center gap-6 rounded-2xl border border-foreground/10 bg-background px-6 py-10 text-center shadow-sm sm:px-10">
      {/* eslint-disable-next-line @next/next/no-img-element -- logoUrl varía en formato (svg/png) entre clientes, mismo patrón que Header.tsx */}
      <img src={logoUrl} alt={businessName} className="h-12 w-auto object-contain" />
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">Panel del negocio</p>
        <h1 className="mt-2 font-heading text-2xl font-bold text-foreground">Administrar {businessName}</h1>
        <p className="mt-2 text-sm text-foreground/60">
          {description ?? "Gestiona reservas, horarios y clientes desde un solo lugar."}
        </p>
      </div>
      {googleEnabled && (
        <>
          <GoogleLoginButton clientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!} />
          {divider()}
        </>
      )}
      {passwordEnabled && (
        <>
          <PasswordLoginForm />
          {divider()}
        </>
      )}
      {claveEnabled && <ClaveLoginForm endpoint={claveEndpoint} />}
      {methods === 0 && (
        <p className="text-sm text-foreground/60">
          El acceso al panel no está configurado todavía — contacta a HarayaDev para activarlo.
        </p>
      )}
    </div>
  );
}
