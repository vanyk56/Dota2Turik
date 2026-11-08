// [Phase: MVP v1] Server Session & Steam Authentication Service (Section 5)
import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import type { User } from '@prisma/client';
import { db } from '@/lib/db';
import { PLATFORM_CONFIG } from '@/lib/config';
import { sha256Hex } from '@/server/crypto';
import { fetchSteamProfileSummary } from './steam-api';
import { recordAuditLog } from '@/modules/audit/service';

export function generateSessionToken(): { rawToken: string; tokenHash: string } {
  const rawToken = crypto
    .randomBytes(PLATFORM_CONFIG.sessions.tokenBytes)
    .toString('hex');
  const tokenHash = sha256Hex(rawToken);
  return { rawToken, tokenHash };
}

export async function upsertUserFromSteam(steamId64: string): Promise<User> {
  const summary = await fetchSteamProfileSummary(steamId64);
  const now = new Date();
  const adminCount = await db.user
    .count({ where: { role: 'admin' } })
    .catch(() => 1);

  const user = await db.user.upsert({
    where: { steamId64 },
    update: {
      nickname: summary.nickname,
      avatarUrl: summary.avatarUrl,
      profileUrl: summary.profileUrl,
      visibility: summary.visibility,
      lastLoginAt: now,
      isAnonymized: false,
      ...(adminCount === 0 ? { role: 'admin' } : {}),
    },
    create: {
      steamId64,
      nickname: summary.nickname,
      avatarUrl: summary.avatarUrl,
      profileUrl: summary.profileUrl,
      visibility: summary.visibility,
      lastLoginAt: now,
      role: adminCount === 0 ? 'admin' : 'user',
    },
  });

  return user;
}

export async function refreshUserSteamProfile(userId: string): Promise<User> {
  const existing = await db.user.findUnique({ where: { id: userId } });
  if (!existing) {
    throw new Error('USER_NOT_FOUND');
  }

  const summary = await fetchSteamProfileSummary(existing.steamId64);
  const updated = await db.user.update({
    where: { id: userId },
    data: {
      nickname: summary.nickname,
      avatarUrl: summary.avatarUrl,
      profileUrl: summary.profileUrl,
      visibility: summary.visibility,
    },
  });

  await recordAuditLog({
    actorId: userId,
    action: 'user.profile.refreshed',
    entityType: 'User',
    entityId: userId,
    payload: { nickname: updated.nickname },
  });

  return updated;
}

export async function createServerSession(
  userId: string,
  userAgent?: string | null,
): Promise<string> {
  const { rawToken, tokenHash } = generateSessionToken();
  const ttlMs = PLATFORM_CONFIG.sessions.ttlDays * 24 * 60 * 60 * 1000;
  const expiresAt = new Date(Date.now() + ttlMs);

  await db.session.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
      userAgent: userAgent ? userAgent.slice(0, 255) : null,
    },
  });

  const cookieStore = cookies();
  cookieStore.set(PLATFORM_CONFIG.sessions.cookieName, rawToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  });

  return rawToken;
}

export async function getCurrentUser(): Promise<User | null> {
  try {
    const cookieStore = cookies();
    const rawToken = cookieStore.get(PLATFORM_CONFIG.sessions.cookieName)?.value;
    if (!rawToken || rawToken.length < 32) {
      return null;
    }

    const tokenHash = sha256Hex(rawToken);
    const now = new Date();

    const session = await db.session.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!session || session.revokedAt !== null || session.expiresAt <= now) {
      return null;
    }

    if (session.user.isBlocked) {
      return null;
    }

    // Sliding window session extension if within refresh threshold
    const thresholdMs =
      PLATFORM_CONFIG.sessions.slidingWindowRefreshThresholdDays *
      24 *
      60 *
      60 *
      1000;
    if (session.expiresAt.getTime() - now.getTime() < thresholdMs) {
      const newExpiresAt = new Date(
        now.getTime() + PLATFORM_CONFIG.sessions.ttlDays * 24 * 60 * 60 * 1000,
      );
      await db.session
        .update({
          where: { id: session.id },
          data: { expiresAt: newExpiresAt },
        })
        .catch(() => null);
    }

    return session.user;
  } catch {
    return null;
  }
}

export async function revokeCurrentSession(): Promise<void> {
  const cookieStore = cookies();
  const rawToken = cookieStore.get(PLATFORM_CONFIG.sessions.cookieName)?.value;

  if (rawToken) {
    const tokenHash = sha256Hex(rawToken);
    await db.session
      .updateMany({
        where: { tokenHash, revokedAt: null },
        data: { revokedAt: new Date() },
      })
      .catch(() => null);
  }

  cookieStore.delete(PLATFORM_CONFIG.sessions.cookieName);
}

export async function revokeAllUserSessions(userId: string): Promise<void> {
  await db.session.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  await recordAuditLog({
    actorId: userId,
    action: 'auth.sessions.revoked_all',
    entityType: 'User',
    entityId: userId,
  });

  const cookieStore = cookies();
  cookieStore.delete(PLATFORM_CONFIG.sessions.cookieName);
}
