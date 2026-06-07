import { defineConfig } from 'drizzle-kit';

const databaseUrl = process.env.DATABASE_URL ?? './packages/db/pglite-data';

export default defineConfig({
  schema: './packages/db/src/schema.ts',
  out: './packages/db/drizzle',
  dialect: 'postgresql',
  driver: 'pglite',
  dbCredentials: {
    url: databaseUrl,
  },
  verbose: true,
  strict: true,
});
