import { PdfWriter } from "@/lib/pdf-utils";

// El texto legal viene íntegro de la plantilla que Rossana cargó en el panel
// (ver lib/realestate-store.ts renderContract) — acá solo se maqueta a PDF,
// nunca se redacta ni completa cláusula alguna.
export async function buildContractPdf(opts: { businessName: string; templateName: string; renderedText: string; date: string }): Promise<Uint8Array> {
  const w = await PdfWriter.create();
  w.heading(opts.templateName);
  w.text(`${opts.businessName} — generado el ${opts.date}`, { size: 9, gap: 16 });
  w.text(opts.renderedText);
  return w.save();
}
