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
    ALTER TABLE draw_results ADD COLUMN IF NOT EXISTS is_public_winner boolean NOT NULL DEFAULT false;
    ALTER TABLE draw_results ADD COLUMN IF NOT EXISTS winner_photo_url text;
    ALTER TABLE draw_results ADD COLUMN IF NOT EXISTS winner_comment text;
    ALTER TABLE draw_results ADD COLUMN IF NOT EXISTS display_order integer NOT NULL DEFAULT 0;
    CREATE TABLE IF NOT EXISTS delivery_gallery_images (
      id text PRIMARY KEY,
      seller_id text NOT NULL REFERENCES sellers(id) ON DELETE cascade,
      image_url text NOT NULL,
      title text,
      caption text,
      is_public boolean NOT NULL DEFAULT true,
      display_order integer NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS delivery_gallery_seller_public_idx
      ON delivery_gallery_images(seller_id, is_public);
  `);

  // Migrate raffles created under the old eager model to lazy allocation:
  // available numbers must NOT have rows (no row = available). This is
  // idempotent and only removes rows that carry no reservation/assignment.
  await client.exec(`DELETE FROM raffle_numbers WHERE status = 'available';`);
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
