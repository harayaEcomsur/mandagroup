import { z } from "zod";
import { clientConfig } from "@/config/client.config";

export const runtime = "nodejs";

const contactSchema = z.object({
  name: z.string().min(1),
  contactInfo: z.string().min(1),
  message: z.string().min(1).max(2000),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = contactSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const destination = clientConfig.contact.email;
  const apiKey = process.env.RESEND_API_KEY;

  if (!destination || !apiKey) {
    return Response.json(
      { error: "El formulario de contacto no está configurado (falta email de destino o RESEND_API_KEY)." },
      { status: 501 }
    );
  }

  const { name, contactInfo, message } = parsed.data;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Sitio web <onboarding@resend.dev>",
      to: destination,
      subject: `Nuevo contacto de ${name} — ${clientConfig.meta.businessName}`,
      text: `Nombre: ${name}\nContacto: ${contactInfo}\n\nMensaje:\n${message}`,
    }),
  });

  if (!res.ok) {
    return Response.json({ error: "No se pudo enviar el mensaje. Intenta más tarde." }, { status: 502 });
  }

  return Response.json({ ok: true });
}
