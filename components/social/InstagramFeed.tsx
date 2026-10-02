import Image from "next/image";
import { Instagram } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { getInstagramFeed, instagramHandle } from "@/lib/instagram";

// Se muestra automáticamente cuando el config trae un link de Instagram
// (contact.socials) — sin token configurado, solo el botón de seguir; con
// INSTAGRAM_ACCESS_TOKEN + INSTAGRAM_USER_ID (ver README), la grilla real.
export async function InstagramFeed({ instagramUrl, businessName }: { instagramUrl: string; businessName: string }) {
  const posts = await getInstagramFeed();
  const handle = instagramHandle(instagramUrl);

  return (
    <section className="py-16 sm:py-24">
      <Container>
        <div className="flex flex-col items-center gap-3 text-center">
          <Instagram className="text-primary" size={32} />
          <h2 className="font-heading text-3xl font-bold text-foreground">Síguenos en Instagram</h2>
          <p className="text-foreground/70">
            {handle} — novedades, trabajos y promociones de {businessName}.
          </p>
        </div>

        {posts && posts.length > 0 ? (
          <div className="mt-10 grid grid-cols-3 gap-3 sm:gap-4 lg:grid-cols-6">
            {posts.map((post) => (
              <a
                key={post.id}
                href={post.permalink}
                target="_blank"
                rel="noopener noreferrer"
                className="group relative aspect-square overflow-hidden rounded-xl"
              >
                <Image
                  src={post.mediaUrl}
                  alt={post.caption?.slice(0, 120) || "Publicación de Instagram"}
                  fill
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                  sizes="(min-width: 1024px) 16vw, 33vw"
                />
              </a>
            ))}
          </div>
        ) : null}

        <div className="mt-8 flex justify-center">
          <a
            href={instagramUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl border-[1.5px] border-foreground/20 px-6 py-3 text-sm font-bold uppercase tracking-wider text-foreground transition-colors hover:border-primary hover:text-primary"
          >
            <Instagram size={18} />
            Ver perfil en Instagram
          </a>
        </div>
      </Container>
    </section>
  );
}
