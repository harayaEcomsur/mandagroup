import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { clientConfig } from "@/config/client.config";
import { currentAdminUser } from "@/lib/auth";

// Subida de cartas (PDF) desde /eventos/admin directo del navegador a Vercel
// Blob ("client upload"): el archivo NO pasa por esta función — solo se firma
// un token. Necesario porque una función de Vercel acepta como máximo 4,5 MB
// y una carta puede pesar más (la de Manda original pesaba 27 MB).
export const runtime = "nodejs";

const MAX_BYTES = 40 * 1024 * 1024;

export async function POST(req: Request) {
  if (!clientConfig.modules.eventos) return Response.json({ error: "Módulo no habilitado" }, { status: 404 });
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return Response.json({ error: "La subida de archivos no está configurada (falta Vercel Blob)." }, { status: 503 });
  }
  const body = (await req.json().catch(() => null)) as HandleUploadBody | null;
  if (!body) return Response.json({ error: "Datos inválidos" }, { status: 400 });

  try {
    const result = await handleUpload({
      request: req,
      body,
      // La sesión del panel viaja en la cookie; la clave heredada, en el payload.
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const user = await currentAdminUser(clientPayload || null);
        if (!user) throw new Error("No autorizado");
        if (!pathname.startsWith("cartas/")) throw new Error("Ruta inválida");
        return {
          allowedContentTypes: ["application/pdf"],
          maximumSizeInBytes: MAX_BYTES,
          addRandomSuffix: true,
        };
      },
      // La carta se guarda desde el panel apenas termina la subida (con la URL
      // que devuelve el cliente), así que no hace falta esperar este aviso.
      onUploadCompleted: async () => {},
    });
    return Response.json(result);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error al subir";
    return Response.json({ error: msg }, { status: msg === "No autorizado" ? 401 : 400 });
  }
}
