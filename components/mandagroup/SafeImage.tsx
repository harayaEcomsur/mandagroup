"use client";

import { useState, type ReactNode } from "react";
import Image, { type ImageProps } from "next/image";

// next/image que, si la imagen no carga (flyer borrado en Vesti, link de
// Instagram vencido), muestra `fallback` en vez del ícono de imagen rota.
export function SafeImage({ fallback, ...props }: ImageProps & { fallback?: ReactNode }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <>
        {fallback ?? (
          <div aria-hidden className="absolute inset-0 bg-gradient-to-br from-primary/25 via-background to-background" />
        )}
      </>
    );
  }
  return <Image {...props} onError={() => setFailed(true)} />;
}
