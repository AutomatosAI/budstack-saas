import { PrismaClient } from '@prisma/client'
import { getTenantContext } from '@/lib/tenant-context';

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
  prisma.$use(async (params, next) => {
    const tenantId = getTenantContext();
    if (!tenantId || !params.model || !tenantScopedModels.has(params.model)) {
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
}
