import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres';

export async function up({ db }: MigrateUpArgs): Promise<void> {
  // 1. Add column with default true for all standard prizes
  await db.execute(sql`
    ALTER TABLE "prizes" ADD COLUMN IF NOT EXISTS "winner_notification_enabled" boolean DEFAULT true NOT NULL;
  `);

  // 2. Set initial seed value for existing prize by exact canonical name
  interface PrizeMatch {
    id: number;
    name: string;
  }
  const matchRes = await db.execute(sql`
    SELECT id, name FROM "prizes" WHERE LOWER(TRIM(name)) = 'spin the wheel at the branch'
  `);

  const rows = (matchRes.rows || []) as unknown as PrizeMatch[];
  if (rows.length === 1) {
    const targetId = rows[0].id;
    await db.execute(sql`
      UPDATE "prizes" SET "winner_notification_enabled" = false WHERE id = ${targetId};
    `);
  } else if (rows.length === 0) {
    throw new Error(
      '[MIGRATION ABORTED] Target prize with exact name "Spin The Wheel at the branch" was NOT found in prizes table. Rolling back migration to prevent unintended notification activation.'
    );
  } else {
    throw new Error(
      `[MIGRATION ABORTED] Ambiguous prize matches: Found ${rows.length} prizes with exact name "Spin The Wheel at the branch". Rolling back migration to ensure safe manual verification.`
    );
  }
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "prizes" DROP COLUMN IF EXISTS "winner_notification_enabled";
  `);
}
