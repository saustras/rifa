import { defineConfig } from 'drizzle-kit';

const databaseUrl = process.env.DATABASE_URL ?? './packages/db/pglite-data';
const isPostgresUrl =
  databaseUrl.startsWith('postgres://') || databaseUrl.startsWith('postgresql://');

export default defineConfig({
  schema: './packages/db/src/schema.ts',
  out: './packages/db/drizzle',
  dialect: 'postgresql',
  ...(isPostgresUrl ? {} : { driver: 'pglite' as const }),
  dbCredentials: {
    url: databaseUrl,
  },
  verbose: true,
  strict: true,
});
