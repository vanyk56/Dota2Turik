// [Phase: MVP v1] Audit Log Service (Section 3, 4, 14)
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';

export interface CreateAuditLogInput {
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  payload?: Record<string, unknown>;
}

export async function recordAuditLog(input: CreateAuditLogInput) {
  return db.auditLog.create({
    data: {
      actorId: input.actorId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      payload: (input.payload ?? {}) as Prisma.InputJsonValue,
    },
  });
}

export async function listAuditLogs(params?: {
  entityType?: string;
  actorId?: string;
  limit?: number;
  offset?: number;
}) {
  const limit = Math.min(params?.limit ?? 50, 200);
  const offset = params?.offset ?? 0;

  const where: Prisma.AuditLogWhereInput = {};
  if (params?.entityType) where.entityType = params.entityType;
  if (params?.actorId) where.actorId = params.actorId;

  const [items, total] = await Promise.all([
    db.auditLog.findMany({
      where,
      include: {
        actor: {
          select: {
            id: true,
            nickname: true,
            steamId64: true,
            role: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    db.auditLog.count({ where }),
  ]);

  return { items, total, limit, offset };
}
