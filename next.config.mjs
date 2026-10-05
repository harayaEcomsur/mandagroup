/** @type {import('next').NextConfig} */
const nextConfig = {
  // URLs del WordPress anterior de mandagroup.cl (listas por RRPP, puerta,
  // embajadores, reservas, carrito de tickets…): ya no se usan, pero pueden
  // estar indexadas o en links viejos — 301 a la home en vez de un 404 al
  // migrar el dominio a este proyecto.
  async redirects() {
    const legacy = [
      "rolo", "renato", "matias", "asistentes", "listas", "confirmo", "puerta", "puerta2",
      "embajadores", "reservas", "test-reservas", "carbon", "carbonreserva", "carbonreserva1",
      "sample-page", "tickets-cart", "tickets-payment", "tickets-order-confirmation",
      "tickets-order-details", "tickets-process-payment", "tickets-ipn-payment",
    ];
    return [
      ...legacy.map((slug) => ({ source: `/${slug}`, destination: "/", permanent: true })),
      { source: "/wp-admin/:path*", destination: "/", permanent: true },
      { source: "/wp-login.php", destination: "/", permanent: true },
      { source: "/feed", destination: "/", permanent: true },
      { source: "/events/:path*", destination: "/#eventos", permanent: true },
    ];
  },
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**" }],
    // Solo WebP (el default), no AVIF: AVIF pesa algo menos pero tarda
    // bastante más en generarse la primera vez, y acá entran imágenes nuevas
    // seguido (flyers de Vesti, fotos de Instagram) — esa primera espera es
    // justo el "tarda en aparecer". 1 día de caché del optimizador: una vez
    // publicados, esos archivos no cambian.
    minimumCacheTTL: 86400,
  },
};

export default nextConfig;
