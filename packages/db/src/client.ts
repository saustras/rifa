import { PGlite } from '@electric-sql/pglite';
import { count } from 'drizzle-orm';
import { drizzle as drizzleNodePostgres } from 'drizzle-orm/node-postgres';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import { Pool } from 'pg';

import * as schema from './schema';
import { sellers } from './schema';

export const DEFAULT_LOCAL_PGLITE_DATA_DIR = './packages/db/pglite-data';

export type RifaDatabaseDriver = 'pglite' | 'postgresql';

interface RuntimeDatabaseClient {
  readonly exec: (query: string) => Promise<unknown>;
  readonly close: () => Promise<void>;
}

const isPostgresUrl = (databaseUrl: string): boolean =>
  databaseUrl.startsWith('postgres://') || databaseUrl.startsWith('postgresql://');

export const resolveLocalPgliteDataDir = (databaseUrl = process.env.DATABASE_URL): string => {
  if (!databaseUrl) {
    return DEFAULT_LOCAL_PGLITE_DATA_DIR;
  }

  if (isPostgresUrl(databaseUrl)) {
    throw new Error(
      'DATABASE_URL points to PostgreSQL. Use createRifaDatabase() instead of resolveLocalPgliteDataDir().',
    );
  }

  return databaseUrl;
};

export const ensureLocalSchema = async (client: RuntimeDatabaseClient): Promise<void> => {
  await client.exec(`
    ALTER TABLE raffles ADD COLUMN IF NOT EXISTS landing_config jsonb;
    ALTER TABLE raffles ADD COLUMN IF NOT EXISTS payment_qr_image_url text;
    ALTER TABLE sellers ADD COLUMN IF NOT EXISTS settings jsonb;
  `);
};

export const createPgliteDatabase = (dataDir = resolveLocalPgliteDataDir()) => {
  const client = new PGlite(dataDir);
  const db = drizzlePglite(client, { schema });

  return {
    client,
    db,
    driver: 'pglite' satisfies RifaDatabaseDriver,
  } as const;
};

export const createPostgresDatabase = (databaseUrl: string) => {
  const pool = new Pool({ connectionString: databaseUrl });
  const db = drizzleNodePostgres(pool, { schema });
  const client: RuntimeDatabaseClient = {
    exec: async (query: string) => pool.query(query),
    close: async () => pool.end(),
  };

  return {
    client,
    db: db as unknown as ReturnType<typeof drizzlePglite<typeof schema>>,
    driver: 'postgresql' satisfies RifaDatabaseDriver,
  } as const;
};

export const createRifaDatabase = (databaseUrl = process.env.DATABASE_URL) => {
  if (databaseUrl && isPostgresUrl(databaseUrl)) {
    return createPostgresDatabase(databaseUrl);
  }

  return createPgliteDatabase(resolveLocalPgliteDataDir(databaseUrl));
};

/**
 * @deprecated Use createRifaDatabase(). Kept as a compatibility bridge for older modules.
 */
export const createLocalPgliteDatabase = createRifaDatabase;

export type LocalPgliteDatabase = ReturnType<typeof createRifaDatabase>;

export const getLocalDatabaseHealth = async (): Promise<{
  readonly driver: RifaDatabaseDriver;
  readonly sellersCount: number;
}> => {
  const { client, db, driver } = createRifaDatabase();

  try {
    const [result] = await db.select({ value: count() }).from(sellers);

    return {
      driver,
      sellersCount: result?.value ?? 0,
    };
  } finally {
    await client.close();
  }
};
