import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres';

export async function up({ db }: MigrateUpArgs): Promise<void> {
  // 1. Add max_claims_per_phone & allow_repeat_mode to drink_campaigns
  await db.execute(sql`
    ALTER TABLE "drink_campaigns"
    ADD COLUMN IF NOT EXISTS "max_claims_per_phone" integer DEFAULT 1 NOT NULL,
    ADD COLUMN IF NOT EXISTS "allow_repeat_mode" varchar(32) DEFAULT 'NEVER' NOT NULL;
  `);

  // 2. Add reclaim_allowed to drink_entitlements
  await db.execute(sql`
    ALTER TABLE "drink_entitlements"
    ADD COLUMN IF NOT EXISTS "reclaim_allowed" boolean DEFAULT false NOT NULL;
  `);

  // 3. Drop rigid unique constraint and create partial unique index + performance index
  await db.execute(sql`
    ALTER TABLE "drink_entitlements"
    DROP CONSTRAINT IF EXISTS "drink_entitlements_campaign_phone_unique";

    CREATE UNIQUE INDEX IF NOT EXISTS "drink_entitlements_active_phone_unique"
    ON "drink_entitlements" ("campaign_id", "phone")
    WHERE (status = 'ISSUED' AND reclaim_allowed = false);

    CREATE INDEX IF NOT EXISTS "drink_entitlements_eligibility_idx"
    ON "drink_entitlements" ("campaign_id", "phone", "status", "reclaim_allowed");
  `);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "drink_entitlements_eligibility_idx";
    DROP INDEX IF EXISTS "drink_entitlements_active_phone_unique";

    ALTER TABLE "drink_entitlements"
    ADD CONSTRAINT "drink_entitlements_campaign_phone_unique" UNIQUE ("campaign_id", "phone");

    ALTER TABLE "drink_entitlements"
    DROP COLUMN IF EXISTS "reclaim_allowed";

    ALTER TABLE "drink_campaigns"
    DROP COLUMN IF EXISTS "max_claims_per_phone",
    DROP COLUMN IF EXISTS "allow_repeat_mode";
  `);
}

