import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

// Runtime connection — pooled (DATABASE_URL), safe for serverless/edge fan-out.
// The Prisma CLI (migrate, studio) uses the direct connection instead, configured
// separately in prisma.config.ts, per Supabase's pooler + migrations constraint.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient() {
	const connectionString =
		process.env.DATABASE_URL ||
		(process.env.CI || process.env.NODE_ENV === "production"
			? "postgresql://postgres:postgres@localhost:5432/astrea"
			: undefined);
	if (!connectionString) {
		throw new Error("DATABASE_URL is not set");
	}
	const adapter = new PrismaPg({ connectionString });
	return new PrismaClient({ adapter });
}

// Reused across hot reloads in dev so we don't exhaust the connection pool.
export const db = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
	globalForPrisma.prisma = db;
}
