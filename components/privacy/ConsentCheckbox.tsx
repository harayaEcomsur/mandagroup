"use client";

// Checkbox de consentimiento (Ley 21.719: debe ser explícito, sin premarcar)
// para cualquier formulario que recolecte datos personales. `checked`/`onChange`
// se controlan desde el formulario que lo usa — este componente solo es el
// control + el texto + el link a la política, para no repetir el copy en cada
// formulario del sitio.
export function ConsentCheckbox({
  checked,
  onChange,
  id = "consent",
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  id?: string;
}) {
  return (
    <label htmlFor={id} className="flex items-start gap-2 text-sm text-foreground/70">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        required
        className="mt-0.5 h-4 w-4 shrink-0 rounded border-foreground/30"
      />
      <span>
        Acepto que mis datos se usen para responder este mensaje, según la{" "}
        <a href="/privacidad" target="_blank" rel="noopener noreferrer" className="underline hover:text-primary">
          política de privacidad
        </a>
        .
      </span>
    </label>
  );
}
