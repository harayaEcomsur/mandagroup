// Feed de Instagram (opcional). Sin configurar nada, el sitio igual muestra un
// botón "Síguenos en Instagram" con el link del config — cero setup. Si además
// se conecta una cuenta Business/Creator real vía Instagram Graph API
// (INSTAGRAM_ACCESS_TOKEN + INSTAGRAM_USER_ID), se reemplaza por una grilla con
// las últimas fotos reales. Mismo patrón que el aviso por WhatsApp: gratis por
// defecto, con upgrade opcional a la API real cuando el cliente la conecta.

export interface InstagramPost {
  id: string;
  caption?: string;
  mediaUrl: string;
  permalink: string;
}

const FIELDS = "id,caption,media_type,media_url,thumbnail_url,permalink";

export async function getInstagramFeed(limit = 6): Promise<InstagramPost[] | null> {
  const token = process.env.INSTAGRAM_ACCESS_TOKEN;
  const userId = process.env.INSTAGRAM_USER_ID;
  if (!token || !userId) return null;

  try {
    const url = `https://graph.instagram.com/${userId}/media?fields=${FIELDS}&limit=${limit}&access_token=${token}`;
    // Cache de 1h: no tiene sentido pegarle a la API en cada carga de la home.
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    const data: { data?: Array<Record<string, string>> } = await res.json();

    return (data.data ?? [])
      .filter((item) => item.media_type !== "VIDEO" || item.thumbnail_url)
      .slice(0, limit)
      .map((item) => ({
        id: item.id,
        caption: item.caption,
        // Un video no tiene media_url usable como imagen — se muestra su miniatura.
        mediaUrl: item.media_type === "VIDEO" ? item.thumbnail_url : item.media_url,
        permalink: item.permalink,
      }));
  } catch (error) {
    console.error("[instagram] getInstagramFeed:", error);
    return null;
  }
}

// "https://instagram.com/nailscolor.cl/" -> "@nailscolor.cl"
export function instagramHandle(url: string): string {
  try {
    const handle = new URL(url).pathname.replace(/\//g, "");
    return handle ? `@${handle}` : url;
  } catch {
    return url;
  }
}

// --- Feed por cuenta (varias marcas en un mismo sitio) ---
// Mismo endpoint, pero con el token propio de cada cuenta (Instagram Login:
// /me/media del dueño del token). Lo usa la home de Manda Group para mostrar
// el feed de cada marca del grupo; una cuenta sin token configurado devuelve
// null y la home cae a un link al perfil.

export interface InstagramMedia extends InstagramPost {
  timestamp: string;
}

export async function getAccountMedia(token: string | undefined, limit = 6): Promise<InstagramMedia[] | null> {
  if (!token) return null;
  try {
    const url = `https://graph.instagram.com/me/media?fields=${FIELDS},timestamp&limit=${limit}&access_token=${token}`;
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) {
      console.error("[instagram] getAccountMedia:", res.status, await res.text().catch(() => ""));
      return null;
    }
    const data: { data?: Array<Record<string, string>> } = await res.json();
    return (data.data ?? [])
      .filter((item) => (item.media_type === "VIDEO" ? item.thumbnail_url : item.media_url))
      .map((item) => ({
        id: item.id,
        caption: item.caption,
        mediaUrl: item.media_type === "VIDEO" ? item.thumbnail_url : item.media_url,
        permalink: item.permalink,
        timestamp: item.timestamp,
      }));
  } catch (error) {
    console.error("[instagram] getAccountMedia:", error);
    return null;
  }
}
