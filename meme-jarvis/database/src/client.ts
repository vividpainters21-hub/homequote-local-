import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var __memeJarvisPrisma: PrismaClient | undefined;
}

/**
 * Single shared Prisma client for the whole monorepo. Reused across hot
 * reloads in dev so we don't exhaust Postgres connections.
 */
export const prisma: PrismaClient =
  globalThis.__memeJarvisPrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.__memeJarvisPrisma = prisma;
}
