import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres';

export async function up({ db }: MigrateUpArgs): Promise<void> {
  // 0. Update Notifications Template Enum with Drink Rewards Templates
  await db.execute(sql`
    ALTER TYPE "enum_notifications_template" ADD VALUE IF NOT EXISTS 'drink-reward-otp';
    ALTER TYPE "enum_notifications_template" ADD VALUE IF NOT EXISTS 'drink-reward-voucher';
    ALTER TYPE "enum_notifications_template" ADD VALUE IF NOT EXISTS 'drink-reward-admin-alert';
  `);

  // 1. Drink Categories Table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "drink_categories" (
      "id" serial PRIMARY KEY,
      "name" varchar(255) NOT NULL,
      "slug" varchar(255) NOT NULL,
      "description" text,
      "active" boolean DEFAULT true NOT NULL,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS "drink_categories_slug_idx" ON "drink_categories" ("slug");
    CREATE INDEX IF NOT EXISTS "drink_categories_active_idx" ON "drink_categories" ("active");
  `);

  // 2. Branches Table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "branches" (
      "id" serial PRIMARY KEY,
      "name" varchar(255) NOT NULL,
      "code" varchar(64) NOT NULL,
      "address" text,
      "active" boolean DEFAULT true NOT NULL,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS "branches_code_idx" ON "branches" ("code");
    CREATE INDEX IF NOT EXISTS "branches_active_idx" ON "branches" ("active");
  `);

  // 3. Drinks Table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "drinks" (
      "id" serial PRIMARY KEY,
      "name" varchar(255) NOT NULL,
      "category_id" integer NOT NULL REFERENCES "drink_categories"("id") ON DELETE RESTRICT,
      "image_id" integer REFERENCES "media"("id") ON DELETE SET NULL,
      "description" text,
      "active" boolean DEFAULT true NOT NULL,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL
    );
    CREATE INDEX IF NOT EXISTS "drinks_category_idx" ON "drinks" ("category_id");
    CREATE INDEX IF NOT EXISTS "drinks_active_idx" ON "drinks" ("active");
  `);

  // 4. Drink Campaigns Table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "drink_campaigns" (
      "id" serial PRIMARY KEY,
      "title" varchar(255) NOT NULL,
      "slug" varchar(255) NOT NULL,
      "start_date" timestamp with time zone NOT NULL,
      "end_date" timestamp with time zone NOT NULL,
      "max_claims" integer,
      "total_claimed" integer DEFAULT 0 NOT NULL,
      "active" boolean DEFAULT true NOT NULL,
      "banner_image_id" integer REFERENCES "media"("id") ON DELETE SET NULL,
      "description" text,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS "drink_campaigns_slug_idx" ON "drink_campaigns" ("slug");
    CREATE INDEX IF NOT EXISTS "drink_campaigns_active_idx" ON "drink_campaigns" ("active");
    CREATE INDEX IF NOT EXISTS "drink_campaigns_dates_idx" ON "drink_campaigns" ("start_date", "end_date");
  `);

  // 5. Drink Campaigns Relationships (hasMany allowed_categories & allowed_branches)
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "drink_campaigns_rels" (
      "id" serial PRIMARY KEY,
      "order" integer,
      "parent_id" integer NOT NULL REFERENCES "drink_campaigns"("id") ON DELETE CASCADE,
      "path" varchar(255) NOT NULL,
      "drink_categories_id" integer REFERENCES "drink_categories"("id") ON DELETE CASCADE,
      "branches_id" integer REFERENCES "branches"("id") ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS "drink_campaigns_rels_parent_idx" ON "drink_campaigns_rels" ("parent_id", "path");
  `);

  // 6. Drink Entitlements Table (Vouchers)
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "drink_entitlements" (
      "id" serial PRIMARY KEY,
      "voucher_code" varchar(32) NOT NULL,
      "campaign_id" integer NOT NULL REFERENCES "drink_campaigns"("id") ON DELETE RESTRICT,
      "phone" varchar(32) NOT NULL,
      "customer_name" varchar(255) NOT NULL,
      "selected_drink_id" integer NOT NULL REFERENCES "drinks"("id") ON DELETE RESTRICT,
      "redeemed_drink_id" integer REFERENCES "drinks"("id") ON DELETE SET NULL,
      "status" varchar(32) DEFAULT 'ISSUED' NOT NULL,
      "branch_id" integer REFERENCES "branches"("id") ON DELETE SET NULL,
      "cashier_id" integer REFERENCES "users"("id") ON DELETE SET NULL,
      "change_reason" text,
      "allowed_drinks_snapshot" jsonb,
      "issued_at" timestamp with time zone NOT NULL,
      "redeemed_at" timestamp with time zone,
      "expires_at" timestamp with time zone NOT NULL,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
      CONSTRAINT "drink_entitlements_campaign_phone_unique" UNIQUE ("campaign_id", "phone")
    );
    CREATE UNIQUE INDEX IF NOT EXISTS "drink_entitlements_voucher_code_idx" ON "drink_entitlements" ("voucher_code");
    CREATE INDEX IF NOT EXISTS "drink_entitlements_campaign_idx" ON "drink_entitlements" ("campaign_id");
    CREATE INDEX IF NOT EXISTS "drink_entitlements_phone_idx" ON "drink_entitlements" ("phone");
    CREATE INDEX IF NOT EXISTS "drink_entitlements_status_idx" ON "drink_entitlements" ("status");
    CREATE INDEX IF NOT EXISTS "drink_entitlements_branch_idx" ON "drink_entitlements" ("branch_id");
  `);

  // 7. Drink Cashier Assignments Table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "drink_cashier_assignments" (
      "id" serial PRIMARY KEY,
      "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "branch_id" integer NOT NULL REFERENCES "branches"("id") ON DELETE RESTRICT,
      "active" boolean DEFAULT true NOT NULL,
      "assigned_at" timestamp with time zone DEFAULT now(),
      "created_at" timestamp with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL
    );
    CREATE INDEX IF NOT EXISTS "drink_cashier_assignments_user_idx" ON "drink_cashier_assignments" ("user_id", "active");
  `);

  // 8. Drink OTP Challenges Table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "drink_otp_challenges" (
      "id" serial PRIMARY KEY,
      "phone" varchar(32) NOT NULL,
      "campaign_id" integer NOT NULL REFERENCES "drink_campaigns"("id") ON DELETE CASCADE,
      "code" varchar(32) NOT NULL,
      "expires_at" timestamp with time zone NOT NULL,
      "last_sent_at" timestamp with time zone NOT NULL,
      "attempts" integer DEFAULT 0 NOT NULL,
      "verified_at" timestamp with time zone,
      "used_at" timestamp with time zone,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL
    );
    CREATE INDEX IF NOT EXISTS "drink_otp_challenges_phone_campaign_idx" ON "drink_otp_challenges" ("phone", "campaign_id");
    CREATE INDEX IF NOT EXISTS "drink_otp_challenges_expires_idx" ON "drink_otp_challenges" ("expires_at");
  `);

  // 9. Payload Document Locking support for new collections
  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels"
      ADD COLUMN IF NOT EXISTS "drink_categories_id" integer REFERENCES "drink_categories"("id") ON DELETE CASCADE,
      ADD COLUMN IF NOT EXISTS "drinks_id" integer REFERENCES "drinks"("id") ON DELETE CASCADE,
      ADD COLUMN IF NOT EXISTS "branches_id" integer REFERENCES "branches"("id") ON DELETE CASCADE,
      ADD COLUMN IF NOT EXISTS "drink_campaigns_id" integer REFERENCES "drink_campaigns"("id") ON DELETE CASCADE,
      ADD COLUMN IF NOT EXISTS "drink_entitlements_id" integer REFERENCES "drink_entitlements"("id") ON DELETE CASCADE,
      ADD COLUMN IF NOT EXISTS "drink_cashier_assignments_id" integer REFERENCES "drink_cashier_assignments"("id") ON DELETE CASCADE,
      ADD COLUMN IF NOT EXISTS "drink_otp_challenges_id" integer REFERENCES "drink_otp_challenges"("id") ON DELETE CASCADE;

    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_drink_categories_id_idx" ON "payload_locked_documents_rels" ("drink_categories_id");
    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_drinks_id_idx" ON "payload_locked_documents_rels" ("drinks_id");
    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_branches_id_idx" ON "payload_locked_documents_rels" ("branches_id");
    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_drink_campaigns_id_idx" ON "payload_locked_documents_rels" ("drink_campaigns_id");
    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_drink_entitlements_id_idx" ON "payload_locked_documents_rels" ("drink_entitlements_id");
    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_drink_cashier_assignments_id_idx" ON "payload_locked_documents_rels" ("drink_cashier_assignments_id");
    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_drink_otp_challenges_id_idx" ON "payload_locked_documents_rels" ("drink_otp_challenges_id");
  `);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels"
      DROP COLUMN IF EXISTS "drink_categories_id",
      DROP COLUMN IF EXISTS "drinks_id",
      DROP COLUMN IF EXISTS "branches_id",
      DROP COLUMN IF EXISTS "drink_campaigns_id",
      DROP COLUMN IF EXISTS "drink_entitlements_id",
      DROP COLUMN IF EXISTS "drink_cashier_assignments_id",
      DROP COLUMN IF EXISTS "drink_otp_challenges_id";

    DROP TABLE IF EXISTS "drink_otp_challenges" CASCADE;
    DROP TABLE IF EXISTS "drink_cashier_assignments" CASCADE;
    DROP TABLE IF EXISTS "drink_entitlements" CASCADE;
    DROP TABLE IF EXISTS "drink_campaigns_rels" CASCADE;
    DROP TABLE IF EXISTS "drink_campaigns" CASCADE;
    DROP TABLE IF EXISTS "drinks" CASCADE;
    DROP TABLE IF EXISTS "branches" CASCADE;
    DROP TABLE IF EXISTS "drink_categories" CASCADE;
  `);
}
