// Renderer liviano para las respuestas del asistente: viñetas, **negrita**,
// links markdown, URLs y rutas internas (/propiedades/…, /agenda, /tienda)
// como enlaces clickeables. Sin dependencias — el subset justo que produce
// el prompt del asistente.
import React from "react";

// [texto](url) | **negrita** | URL externa | ruta interna precedida de
// inicio/espacio/paréntesis (sin lookbehind por compatibilidad Safari viejo).
const INLINE =
  /\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*|(https?:\/\/[^\s)]+)|(^|[\s(])(\/[a-z0-9][a-z0-9-]*(?:\/[a-z0-9-]+)*)/g;

function link(href: string, label: string, key: string) {
  const external = href.startsWith("http");
  return (
    <a
      key={key}
      href={href}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      className="font-medium text-primary underline underline-offset-2"
    >
      {label}
    </a>
  );
}

function renderInline(text: string, keyBase: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let last = 0;
  let i = 0;
  for (const m of text.matchAll(INLINE)) {
    const idx = m.index ?? 0;
    if (idx > last) out.push(text.slice(last, idx));
    const key = `${keyBase}-${i++}`;
    if (m[1] && m[2]) {
      out.push(link(m[2], m[1], key));
    } else if (m[3]) {
      out.push(<strong key={key}>{m[3]}</strong>);
    } else if (m[4]) {
      // Sin puntuación final pegada al link ("…visita https://x.cl.").
      const url = m[4].replace(/[.,;]+$/, "");
      out.push(link(url, url, key));
      if (m[4].length > url.length) out.push(m[4].slice(url.length));
    } else if (m[6] !== undefined) {
      if (m[5]) out.push(m[5]);
      out.push(link(m[6], m[6], key));
    }
    last = idx + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

const BULLET = /^\s*(?:[-*•]|\d+\.)\s+/;

export function ChatMarkdown({ content }: { content: string }) {
  const lines = content.split("\n");
  const blocks: React.ReactNode[] = [];
  let list: string[] = [];

  const flushList = (key: string) => {
    if (!list.length) return;
    blocks.push(
      <ul key={key} className="my-1 list-disc space-y-1 pl-4">
        {list.map((item, j) => (
          <li key={j}>{renderInline(item, `${key}-${j}`)}</li>
        ))}
      </ul>
    );
    list = [];
  };

  lines.forEach((line, i) => {
    if (BULLET.test(line)) {
      list.push(line.replace(BULLET, ""));
      return;
    }
    flushList(`ul-${i}`);
    if (line.trim()) {
      blocks.push(<p key={`p-${i}`}>{renderInline(line, `p-${i}`)}</p>);
    }
  });
  flushList("ul-end");

  return <div className="space-y-1.5 [overflow-wrap:anywhere]">{blocks}</div>;
}
