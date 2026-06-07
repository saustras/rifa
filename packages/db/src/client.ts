import { PGlite } from '@electric-sql/pglite';
import { count } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/pglite';

import * as schema from './schema';
import { sellers } from './schema';

export const DEFAULT_LOCAL_PGLITE_DATA_DIR = './packages/db/pglite-data';

export const resolveLocalPgliteDataDir = (databaseUrl = process.env.DATABASE_URL): string => {
  if (!databaseUrl) {
    return DEFAULT_LOCAL_PGLITE_DATA_DIR;
  }

  if (databaseUrl.startsWith('postgres://') || databaseUrl.startsWith('postgresql://')) {
    throw new Error(
      'DATABASE_URL points to a real PostgreSQL server. Add a production Postgres client before using it at runtime.',
    );
  }

  return databaseUrl;
};

export const ensureLocalSchema = async (client: PGlite): Promise<void> => {
  await client.exec(`
    ALTER TABLE raffles ADD COLUMN IF NOT EXISTS landing_config jsonb;
    ALTER TABLE raffles ADD COLUMN IF NOT EXISTS payment_qr_image_url text;
  `);
};

export const createLocalPgliteDatabase = (dataDir = resolveLocalPgliteDataDir()) => {
  const client = new PGlite(dataDir);
  const db = drizzle(client, { schema });

  return {
    client,
    db,
  } as const;
};

export type LocalPgliteDatabase = ReturnType<typeof createLocalPgliteDatabase>;

export const getLocalDatabaseHealth = async (): Promise<{ readonly sellersCount: number }> => {
  const { client, db } = createLocalPgliteDatabase();

  try {
    const [result] = await db.select({ value: count() }).from(sellers);

    return {
      sellersCount: result?.value ?? 0,
    };
  } finally {
    await client.close();
  }
};
