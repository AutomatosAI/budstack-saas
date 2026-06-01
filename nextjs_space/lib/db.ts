import { PrismaClient } from '@prisma/client'
import { getTenantContext, hasTenantContext } from '@/lib/tenant/tenant-context';
import {
  TenantContextMissingError,
  decideMissingContext,
  emitTenantContextMissing,
  isStrictTenantContext,
} from '@/lib/tenant/tenant-scope-policy';
import {
  applySoftDelete,
  getSoftDeleteFlags,
  isSoftDeletable,
} from '@/lib/soft-delete';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Create a mock Prisma client for build time
const createMockPrismaClient = (): any => {
  const mockModel = {
    findUnique: async () => null,
    findFirst: async () => null,
    findMany: async () => [],
    create: async () => ({}),
    update: async () => ({}),
    delete: async () => ({}),
    count: async () => 0,
  };

  return new Proxy(
    {},
    {
      get: () => mockModel,
    },
  );
};

// Only initialize real Prisma if we have a valid DATABASE_URL and not in build
const shouldUseMockPrisma = () => {
  const dbUrl = process.env.DATABASE_URL || "";
  return dbUrl.includes("dummy") || dbUrl === "";
};

export const prisma =
  globalForPrisma.prisma ??
  (shouldUseMockPrisma()
    ? createMockPrismaClient()
    : new PrismaClient({
      log:
        process.env.NODE_ENV === "development"
          ? ["query", "error", "warn"]
          : ["error"],
    }));

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

const tenantScopedModels = new Set([
  'audit_logs',
  'email_logs',
  'email_templates',
  'email_event_mappings',
  'conditions',
  'consultations',
  'drgreen_carts',
  'drgreen_webhook_logs',
  'kyc_journey_logs',
  'orders',
  'posts',
  'products',
  'tenant_branding',
  'tenant_templates',
  'users',
  'webhooks',
]);

const tenantScopedModelsWithNullAccess = new Set([
  'email_templates',
  'email_event_mappings',
]);

const tenantScopedReadActions = new Set([
  'findMany',
  'findFirst',
  'findUnique',
  'count',
  'aggregate',
  'groupBy',
  'deleteMany',
]);

const tenantScopedWriteManyActions = new Set([
  'updateMany',
  'deleteMany',
]);

const tenantScopedCreateActions = new Set([
  'create',
  'createMany',
  'upsert',
]);

const applyTenantScope = (where: Record<string, any>, tenantId: string, allowNull: boolean) => {
  if (allowNull) {
    return {
      AND: [
        where,
        {
          OR: [{ tenantId }, { tenantId: null }],
        },
      ],
    };
  }

  return {
    ...where,
    tenantId,
  };
};

if ('$use' in prisma) {
  (prisma as any).$use(async (params: any, next: (params: any) => Promise<any>) => {
    const tenantId = getTenantContext();

    // Not a tenant-scoped model → never touch it.
    if (!params.model || !tenantScopedModels.has(params.model)) {
      return next(params);
    }

    // Tenant-scoped model with no resolved tenant id. Distinguish an EXPLICIT
    // null (a deliberately bound system/super-admin/webhook/cron query — allowed)
    // from an IMPLICIT unbound context (the cross-tenant-leak bug — fail loud).
    if (!tenantId) {
      const decision = decideMissingContext({
        model: params.model,
        bound: hasTenantContext(),
        strict: isStrictTenantContext(),
      });
      if (decision !== 'allow') {
        emitTenantContextMissing(params.model, params.action);
      }
      if (decision === 'throw') {
        throw new TenantContextMissingError(params.model, params.action);
      }
      // 'allow' (explicit null / allow-listed) or 'warn' (migration window):
      // run unscoped — the warn has already been emitted above.
      return next(params);
    }

    const allowNull = tenantScopedModelsWithNullAccess.has(params.model);

    if (params.action === 'findUnique') {
      params.action = 'findFirst';
    }

    if (tenantScopedCreateActions.has(params.action)) {
      if (params.args?.data) {
        if (Array.isArray(params.args.data)) {
          params.args.data = params.args.data.map((item: Record<string, any>) => ({
            ...item,
            tenantId: item.tenantId ?? tenantId,
          }));
        } else {
          params.args.data.tenantId = params.args.data.tenantId ?? tenantId;
        }
      }
      if (params.action === 'upsert') {
        if (params.args?.create) {
          params.args.create.tenantId = params.args.create.tenantId ?? tenantId;
        }
      }
      return next(params);
    }

    if (
      tenantScopedReadActions.has(params.action)
      || tenantScopedWriteManyActions.has(params.action)
      || params.action === 'update'
      || params.action === 'delete'
    ) {
      if (params.args?.where) {
        params.args.where = applyTenantScope(params.args.where, tenantId, allowNull);
      } else {
        params.args = {
          ...params.args,
          where: applyTenantScope({}, tenantId, allowNull),
        };
      }
    }

    return next(params);
  });

  // PRD-208 — Soft-delete middleware. Registered AFTER the tenant-scope
  // middleware so it composes as the inner layer: tenant-scope rewrites the
  // `where` (and findUnique→findFirst / adds tenantId) FIRST, then this layer
  // injects `deletedAt: null` into reads and rewrites delete/deleteMany into a
  // `deletedAt = now()` update — preserving any tenant scope already applied.
  //
  // It runs for ALL soft-deletable models, including ones the tenant-scope
  // middleware short-circuits (`tenants`, `templates`, `marketplace_submissions`
  // are not tenant-scoped), because this is a separate `$use` downstream of the
  // tenant-scope `next()`. Escape hatches: withDeleted() / hardDelete().
  (prisma as any).$use(async (params: any, next: (params: any) => Promise<any>) => {
    if (!isSoftDeletable(params.model)) {
      return next(params);
    }
    const rewritten = applySoftDelete(params, getSoftDeleteFlags());
    return next(rewritten);
  });
}
