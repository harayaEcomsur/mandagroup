// Loader de next/image (next.config.mjs → images.loaderFile). Las imágenes
// externas pasan por nuestro /api/img (ver app/api/img/route.ts); las locales
// de /public se sirven tal cual: son pocas y ya vienen livianas.
export default function imageLoader({ src, width, quality }: { src: string; width: number; quality?: number }) {
  if (src.startsWith("/")) return src;
  return `/api/img?url=${encodeURIComponent(src)}&w=${width}&q=${quality ?? 75}`;
}
