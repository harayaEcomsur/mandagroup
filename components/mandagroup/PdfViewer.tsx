"use client";

import { useEffect, useRef, useState } from "react";

// Visor de cartas en PDF dentro de la página (no el visor del teléfono): para
// cualquier carta subida desde el panel. pdf.js se carga recién cuando el
// visor se acerca a la pantalla, y cada página se dibuja solo al llegar a
// ella — una carta larga no descarga ni dibuja todo de una vez.
type PdfJs = typeof import("pdfjs-dist");

let pdfjsPromise: Promise<PdfJs> | null = null;
function loadPdfJs(): Promise<PdfJs> {
  if (!pdfjsPromise) {
    pdfjsPromise = import("pdfjs-dist").then((pdfjs) => {
      // El worker va como archivo estático (public/pdfjs, con la versión en el
      // nombre para que la CDN lo cachee sin riesgo): el minificador de Next
      // no lo procesa bien si se importa. Al actualizar pdfjs-dist, copiar el
      // nuevo node_modules/pdfjs-dist/build/pdf.worker.min.mjs y cambiar acá.
      pdfjs.GlobalWorkerOptions.workerSrc = `/pdfjs/pdf.worker-${pdfjs.version}.min.mjs`;
      return pdfjs;
    });
  }
  return pdfjsPromise;
}

type Doc = Awaited<ReturnType<PdfJs["getDocument"]>["promise"]>;

function PdfPage({ doc, pageNumber, title }: { doc: Doc; pageNumber: number; title: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [ratio, setRatio] = useState<number | null>(null); // alto/ancho, reserva espacio (sin saltos)
  const [drawn, setDrawn] = useState(false);

  useEffect(() => {
    let cancelled = false;
    doc.getPage(pageNumber).then((page) => {
      if (cancelled) return;
      const v = page.getViewport({ scale: 1 });
      setRatio(v.height / v.width);
    });
    return () => {
      cancelled = true;
    };
  }, [doc, pageNumber]);

  useEffect(() => {
    const box = boxRef.current;
    if (!box || drawn || ratio === null) return;
    const io = new IntersectionObserver(
      async ([entry]) => {
        if (!entry.isIntersecting) return;
        io.disconnect();
        const page = await doc.getPage(pageNumber);
        const canvas = canvasRef.current;
        if (!canvas) return;
        // Resolución según el ancho real en pantalla y la densidad del
        // dispositivo (tope 2x: más no se nota y pesa en memoria).
        const width = box.clientWidth * Math.min(window.devicePixelRatio || 1, 2);
        const viewport = page.getViewport({ scale: width / page.getViewport({ scale: 1 }).width });
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvasContext: canvas.getContext("2d")!, viewport }).promise;
        setDrawn(true);
      },
      { rootMargin: "800px 0px" }
    );
    io.observe(box);
    return () => io.disconnect();
  }, [doc, pageNumber, ratio, drawn]);

  return (
    <div
      ref={boxRef}
      className="relative w-full overflow-hidden rounded-2xl bg-foreground/[0.05] ring-1 ring-foreground/10"
      style={{ aspectRatio: ratio ? `1 / ${ratio}` : "1 / 1.29" }}
    >
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={`${title}, página ${pageNumber}`}
        className={`h-full w-full transition-opacity duration-500 ${drawn ? "opacity-100" : "opacity-0"}`}
      />
      {!drawn && (
        <div className="absolute inset-0 animate-pulse bg-gradient-to-b from-foreground/[0.04] to-transparent" aria-hidden />
      )}
    </div>
  );
}

export function PdfViewer({ url, title }: { url: string; title: string }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [doc, setDoc] = useState<Doc | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let cancelled = false;
    const io = new IntersectionObserver(
      async ([entry]) => {
        if (!entry.isIntersecting) return;
        io.disconnect();
        try {
          const pdfjs = await loadPdfJs();
          const loaded = await pdfjs.getDocument({ url, disableAutoFetch: true }).promise;
          if (!cancelled) setDoc(loaded);
        } catch (e) {
          console.error("[PdfViewer]", e);
          if (!cancelled) setError(true);
        }
      },
      { rootMargin: "600px 0px" }
    );
    io.observe(root);
    return () => {
      cancelled = true;
      io.disconnect();
    };
  }, [url]);

  return (
    <div ref={rootRef} className="flex flex-col gap-4">
      {error ? (
        <p className="rounded-2xl bg-foreground/[0.05] p-6 text-sm text-foreground/70 ring-1 ring-foreground/10">
          No pudimos mostrar la carta aquí.{" "}
          <a href={url} target="_blank" rel="noreferrer" className="font-semibold text-primary underline underline-offset-4">
            Ábrela en PDF
          </a>
          .
        </p>
      ) : doc ? (
        Array.from({ length: doc.numPages }, (_, i) => <PdfPage key={i} doc={doc} pageNumber={i + 1} title={title} />)
      ) : (
        <div className="aspect-[1/1.29] w-full animate-pulse rounded-2xl bg-foreground/[0.05] ring-1 ring-foreground/10" aria-hidden />
      )}
    </div>
  );
}
