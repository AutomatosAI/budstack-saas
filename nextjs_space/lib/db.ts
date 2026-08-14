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

// `prisma` is constructed at the bottom of this module — see createPrismaClient()
// — because the $extends query extension closes over the tenant-scope tables and
// applyTenantScope() declared below.

const tenantScopedModels = new Set([
  'audit_logs',
  'email_logs',
  'email_templates',
  'email_event_mappings',
  'email_suppressions',
  'newsletter_subscribers',
  // campaign_recipients is deliberately absent: it carries no tenantId and is
  // reachable only through its campaign, which IS scoped here.
  'campaigns',
  'customer_tags',
  'segments',
  'seo_redirects',
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
  'role_permissions',
  'team_invitations',
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

// Immutably inject the resolved tenantId into create / createMany / upsert
// payloads so every bound write is stamped with its tenant. Mirrors the create
// branch of the former tenant-scope $use, but returns NEW objects (never mutates
// the caller's args).
const injectTenantIdIntoCreate = (
  args: any,
  action: string,
  tenantId: string,
): any => {
  if (!args) return args;
  let next = args;
  if (args.data) {
    next = Array.isArray(args.data)
      ? {
          ...next,
          data: args.data.map((item: Record<string, any>) => ({
            ...item,
            tenantId: item.tenantId ?? tenantId,
          })),
        }
      : {
          ...next,
          data: { ...args.data, tenantId: args.data.tenantId ?? tenantId },
        };
  }
  if (action === 'upsert' && args.create) {
    next = {
      ...next,
      create: { ...args.create, tenantId: args.create.tenantId ?? tenantId },
    };
  }
  return next;
};

// Prisma 6 REMOVED `$use`, so the tenant-scope + soft-delete middlewares that
// used to register as two `$use` hooks silently never ran — tenant isolation
// fell back to per-route `where` clauses only (sev-1). They are ported here to a
// single `$extends` query extension: both transforms run in the SAME order
// (tenant-scope first, soft-delete second) inside one `$allOperations` handler,
// then the operation is dispatched ONCE. When an action is rewritten
// (findUnique→findFirst, delete→update, deleteMany→updateMany) it is re-dispatched
// through the BASE (un-extended) client — that bypasses this extension, so the
// rewrite neither recurses nor double-scopes; both transforms are already applied.
const createPrismaClient = (): any => {
  if (shouldUseMockPrisma()) {
    return createMockPrismaClient();
  }

  const base = new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
  });

  return base.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }: any) {
          const modelName: string =
            typeof model === 'string' ? model.toLowerCase() : model;
          let action: string = operation;
          let nextArgs: any = args;

          // ── Layer 1: tenant scope ──
          if (modelName && tenantScopedModels.has(modelName)) {
            const tenantId = getTenantContext();

            if (!tenantId) {
              // Distinguish an EXPLICIT bound null (system / super-admin / webhook
              // — allowed) from an IMPLICIT unbound context (the leak bug — loud).
              const decision = decideMissingContext({
                model: modelName,
                bound: hasTenantContext(),
                strict: isStrictTenantContext(),
              });
              if (decision !== 'allow') {
                emitTenantContextMissing(modelName, action);
              }
              if (decision === 'throw') {
                throw new TenantContextMissingError(modelName, action);
              }
              // allow / warn → fall through unscoped.
            } else {
              const allowNull = tenantScopedModelsWithNullAccess.has(modelName);

              // findUnique can't carry the AND/OR tenant predicate at the top
              // level of its where, so it becomes findFirst (re-dispatched below).
              if (action === 'findUnique') {
                action = 'findFirst';
              }

              if (tenantScopedCreateActions.has(action)) {
                nextArgs = injectTenantIdIntoCreate(nextArgs, action, tenantId);
              } else if (
                tenantScopedReadActions.has(action) ||
                tenantScopedWriteManyActions.has(action) ||
                action === 'update' ||
                action === 'delete'
              ) {
                nextArgs = {
                  ...nextArgs,
                  where: applyTenantScope(
                    nextArgs?.where ?? {},
                    tenantId,
                    allowNull,
                  ),
                };
              }
            }
          }

          // ── Layer 2: soft-delete ──
          if (isSoftDeletable(modelName)) {
            const rewritten = applySoftDelete(
              { model: modelName, action, args: nextArgs },
              getSoftDeleteFlags(),
            );
            action = rewritten.action;
            nextArgs = rewritten.args;
          }

          // ── Dispatch once ──
          if (action === operation) {
            return query(nextArgs);
          }
          // Operation was rewritten — run it on the BASE client so it does NOT
          // recurse into this extension (both transforms already applied above).
          return (base as any)[modelName][action](nextArgs);
        },
      },
    },
  });
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
