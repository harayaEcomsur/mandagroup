interface Bucket {
  count: number;
  resetAt: number;
}

// Limitador en memoria, básico y sin dependencias externas. En runtime edge/serverless
// esto vive por isolate mientras esté "caliente" — no es un límite distribuido exacto,
// pero es suficiente para frenar abuso puntual en un sitio de tráfico bajo/medio.
// Si un cliente crece mucho, reemplazar por Upstash Ratelimit sin tocar el resto del código.
const buckets = new Map<string, Bucket>();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_REQUESTS = 20;

export function checkRateLimit(key: string): {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
} {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now > bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true, remaining: MAX_REQUESTS - 1, retryAfterSeconds: 0 };
  }

  if (bucket.count >= MAX_REQUESTS) {
    return { allowed: false, remaining: 0, retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000) };
  }

  bucket.count += 1;
  return { allowed: true, remaining: MAX_REQUESTS - bucket.count, retryAfterSeconds: 0 };
}
