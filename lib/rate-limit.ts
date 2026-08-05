import { NextResponse } from "next/server";

// Limitador em memória (janela fixa). Assume um único processo Node.js —
// é o caso deste deploy (container único no EC2). Se a aplicação passar a
// rodar em múltiplas instâncias, isto precisa migrar para um store
// compartilhado (ex.: Redis), senão cada instância conta separadamente.

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
let lastCleanup = Date.now();

function cleanup(now: number) {
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export interface RateLimitResult {
  allowed: boolean;
  resetAt: number;
}

// Chama para cada tentativa. Retorna allowed=false quando o limite da janela
// atual já foi atingido para essa key.
export function checkRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  cleanup(now);

  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    const resetAt = now + windowMs;
    buckets.set(key, { count: 1, resetAt });
    return { allowed: true, resetAt };
  }

  if (bucket.count >= limit) {
    return { allowed: false, resetAt: bucket.resetAt };
  }

  bucket.count += 1;
  return { allowed: true, resetAt: bucket.resetAt };
}

export function rateLimitResponse(result: RateLimitResult): NextResponse {
  const retryAfterSeconds = Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000));
  return NextResponse.json(
    { error: "Muitas tentativas. Tente novamente mais tarde." },
    { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
  );
}
