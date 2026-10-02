import { PdfWriter } from "@/lib/pdf-utils";
import type { REDelivery, REProperty } from "@/lib/realestate-store";

const ESTADO_LABEL: Record<string, string> = { bien: "Bien", regular: "Regular", malo: "Malo", na: "No aplica" };

export async function buildDeliveryPdf(
  delivery: REDelivery,
  opts: { businessName: string; property?: REProperty | null; brokerName: string }
): Promise<Uint8Array> {
  const w = await PdfWriter.create();
  w.heading(opts.businessName);
  w.text(delivery.tipo === "entrega" ? "Informe de entrega de propiedad" : "Informe de recepción de propiedad", { size: 13, bold: true, gap: 10 });
  w.text(`Fecha: ${new Date(delivery.createdAt).toLocaleDateString("es-CL")}`);
  w.text(`Corredor/a a cargo: ${opts.brokerName}`);
  if (opts.property) w.text(`Propiedad: ${opts.property.title}${opts.property.address ? " — " + opts.property.address : ""}`);
  w.hr();

  if (delivery.arrendador?.nombre || delivery.arrendatario?.nombre) {
    w.subheading("Partes");
    if (delivery.arrendador?.nombre) {
      w.text(
        `Arrendador/a: ${delivery.arrendador.nombre}${delivery.arrendador.rut ? " — RUT " + delivery.arrendador.rut : ""}${
          delivery.arrendador.telefono ? " — " + delivery.arrendador.telefono : ""
        }`
      );
    }
    if (delivery.arrendatario?.nombre) {
      w.text(
        `Arrendatario/a: ${delivery.arrendatario.nombre}${delivery.arrendatario.rut ? " — RUT " + delivery.arrendatario.rut : ""}${
          delivery.arrendatario.telefono ? " — " + delivery.arrendatario.telefono : ""
        }`
      );
    }
  }

  const meters = delivery.meterReadings;
  if (meters && (meters.luz || meters.agua || meters.gas)) {
    w.subheading("Lecturas de medidores");
    if (meters.luz) w.text(`Luz: ${meters.luz}`);
    if (meters.agua) w.text(`Agua: ${meters.agua}`);
    if (meters.gas) w.text(`Gas: ${meters.gas}`);
  }

  if (delivery.checklist.length) {
    w.subheading("Checklist de estado");
    for (const item of delivery.checklist) {
      w.text(`• ${item.item}: ${ESTADO_LABEL[item.estado] ?? item.estado}${item.observacion ? " — " + item.observacion : ""}`);
    }
  }

  if (delivery.notes) {
    w.subheading("Observaciones generales");
    w.text(delivery.notes);
  }

  if (delivery.photos.length) {
    w.subheading("Fotografías");
    for (const url of delivery.photos) await w.image(url);
  }

  return w.save();
}
