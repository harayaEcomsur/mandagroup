import { PDFDocument, PDFFont, PDFPage, rgb, StandardFonts } from "pdf-lib";

// Helper mínimo para armar PDFs de una columna (informe de entrega, contratos)
// sin traer una librería de layout completa — pdf-lib no envuelve texto ni
// pagina sola, así que eso vive acá una sola vez en vez de repetirse en cada
// generador.

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const paragraphs = text.split("\n");
  const lines: string[] = [];
  for (const para of paragraphs) {
    if (para.trim() === "") {
      lines.push("");
      continue;
    }
    const words = para.split(/\s+/);
    let current = "";
    for (const word of words) {
      const test = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(test, size) > maxWidth && current) {
        lines.push(current);
        current = word;
      } else {
        current = test;
      }
    }
    if (current) lines.push(current);
  }
  return lines;
}

const PAGE_WIDTH = 595.28; // A4
const PAGE_HEIGHT = 841.89;
const MARGIN = 50;

export class PdfWriter {
  private doc: PDFDocument;
  private font: PDFFont;
  private boldFont: PDFFont;
  private page!: PDFPage;
  private y = 0;

  private constructor(doc: PDFDocument, font: PDFFont, boldFont: PDFFont) {
    this.doc = doc;
    this.font = font;
    this.boldFont = boldFont;
  }

  static async create(): Promise<PdfWriter> {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);
    const writer = new PdfWriter(doc, font, boldFont);
    writer.newPage();
    return writer;
  }

  private newPage() {
    this.page = this.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    this.y = PAGE_HEIGHT - MARGIN;
  }

  private ensureSpace(needed: number) {
    if (this.y - needed < MARGIN) this.newPage();
  }

  text(str: string, opts: { size?: number; bold?: boolean; gap?: number } = {}) {
    const size = opts.size ?? 11;
    const font = opts.bold ? this.boldFont : this.font;
    const maxWidth = PAGE_WIDTH - MARGIN * 2;
    const lines = wrapText(str, font, size, maxWidth);
    for (const line of lines) {
      this.ensureSpace(size + 4);
      if (line) this.page.drawText(line, { x: MARGIN, y: this.y, size, font, color: rgb(0.12, 0.12, 0.12) });
      this.y -= size + 4;
    }
    this.y -= opts.gap ?? 4;
  }

  heading(str: string) {
    this.text(str, { size: 16, bold: true, gap: 12 });
  }

  subheading(str: string) {
    this.ensureSpace(20);
    this.text(str, { size: 12.5, bold: true, gap: 6 });
  }

  hr() {
    this.ensureSpace(10);
    this.page.drawLine({ start: { x: MARGIN, y: this.y }, end: { x: PAGE_WIDTH - MARGIN, y: this.y }, thickness: 0.5, color: rgb(0.75, 0.75, 0.75) });
    this.y -= 12;
  }

  // Si la imagen no se puede descargar o decodificar, no revienta el PDF
  // completo — se omite y sigue el resto del documento.
  async image(url: string, opts: { maxWidth?: number; maxHeight?: number } = {}) {
    try {
      const res = await fetch(url);
      if (!res.ok) return;
      const bytes = new Uint8Array(await res.arrayBuffer());
      const contentType = res.headers.get("content-type") ?? "";
      const img = contentType.includes("png") ? await this.doc.embedPng(bytes) : await this.doc.embedJpg(bytes);
      const maxW = opts.maxWidth ?? 220;
      const maxH = opts.maxHeight ?? 165;
      const scale = Math.min(maxW / img.width, maxH / img.height, 1);
      const w = img.width * scale;
      const h = img.height * scale;
      this.ensureSpace(h + 10);
      this.page.drawImage(img, { x: MARGIN, y: this.y - h, width: w, height: h });
      this.y -= h + 10;
    } catch {
      // omitido a propósito, ver comentario arriba
    }
  }

  async save(): Promise<Uint8Array> {
    return this.doc.save();
  }
}
