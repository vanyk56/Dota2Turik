// [Phase: MVP v1] Postgres-Backed Rate Limiter (Section 14)
import { db } from '@/lib/db';

const fallbackMemoryStore = new Map<string, { count: number; resetAt: number }>();

export interface RateLimitOptions {
  key: string;
  limit: number;
  windowSeconds: number;
}

export async function checkRateLimit(
  options: RateLimitOptions,
): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> {
  const now = new Date();
  const resetAt = new Date(now.getTime() + options.windowSeconds * 1000);

  try {
    const existing = await db.rateLimitEntry.findUnique({
      where: { key: options.key },
    });

    if (!existing || existing.resetAt <= now) {
      await db.rateLimitEntry.upsert({
        where: { key: options.key },
        update: { count: 1, resetAt },
        create: { key: options.key, count: 1, resetAt },
      });
      return {
        allowed: true,
        remaining: Math.max(0, options.limit - 1),
        resetAt,
      };
    }

    if (existing.count >= options.limit) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: existing.resetAt,
      };
    }

    const updated = await db.rateLimitEntry.update({
      where: { key: options.key },
      data: { count: { increment: 1 } },
    });

    return {
      allowed: true,
      remaining: Math.max(0, options.limit - updated.count),
      resetAt: updated.resetAt,
    };
  } catch {
    // Graceful fallback if DB is unreachable
    const mem = fallbackMemoryStore.get(options.key);
    if (!mem || mem.resetAt <= now.getTime()) {
      fallbackMemoryStore.set(options.key, {
        count: 1,
        resetAt: resetAt.getTime(),
      });
      return { allowed: true, remaining: options.limit - 1, resetAt };
    }
    if (mem.count >= options.limit) {
      return { allowed: false, remaining: 0, resetAt: new Date(mem.resetAt) };
    }
    mem.count += 1;
    return {
      allowed: true,
      remaining: Math.max(0, options.limit - mem.count),
      resetAt: new Date(mem.resetAt),
    };
  }
}
