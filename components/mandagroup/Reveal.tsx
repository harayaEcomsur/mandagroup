// Entrada suave (fade + subida corta) hecha SOLO con CSS — sin JavaScript ni
// IntersectionObserver. Antes el contenido nacía invisible en el HTML y
// recién aparecía cuando hidrataba React y el observer lo detectaba (más
// la transición de 700 ms y los retrasos escalonados): en celular eso
// podía ser más de 2 segundos de secciones en blanco.
//
// - "scroll" (por defecto): animación ligada al scroll (animation-timeline:
//   view()). El elemento se va revelando a medida que entra en pantalla, al
//   ritmo del propio scroll: nunca llega "tarde". Navegadores sin soporte lo
//   muestran directo, sin animación.
// - "load": para lo que está arriba del pliegue (hero) — corre apenas se pinta
//   el HTML, sin esperar a React.
// Con prefers-reduced-motion todo queda estático (ver globals.css).
export function Reveal({
  children,
  className = "",
  delay = 0,
  mode = "scroll",
  as: Tag = "div",
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number; // ms; en "scroll" se traduce a un pequeño desfase del rango de entrada
  mode?: "scroll" | "load";
  as?: "div" | "section" | "li" | "article";
}) {
  return (
    <Tag
      style={
        {
          "--reveal-delay": `${delay}ms`,
          // 80 ms de "delay" ≈ 8% más tarde dentro del rango de entrada.
          "--reveal-offset": `${Math.min(delay / 10, 30)}%`,
        } as React.CSSProperties
      }
      className={`${mode === "load" ? "reveal-load" : "reveal"} ${className}`}
    >
      {children}
    </Tag>
  );
}
