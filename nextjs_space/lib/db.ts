import { PrismaClient } from "@prisma/client";

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

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
