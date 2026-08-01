// Prisma CLI config (migrate, introspect, studio) — NOT the runtime connection.
// Supabase does not allow migrations over the pooled connection, so the CLI
// must use DIRECT_URL. The app's runtime client uses the pooled DATABASE_URL
// via a driver adapter instead — see src/lib/db.ts.
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
	schema: "prisma/schema.prisma",
	migrations: {
		path: "prisma/migrations",
	},
	datasource: {
		url: process.env.DIRECT_URL,
	},
});
