import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_users_role" AS ENUM('ADMIN', 'STAFF');
  CREATE TYPE "public"."enum_participants_verification_method" AS ENUM('otp_whatsapp', 'sms', 'manual');
  CREATE TYPE "public"."enum_entries_result" AS ENUM('WIN', 'LOSE', 'INVALID', 'ALREADY_USED');
  CREATE TYPE "public"."enum_prize_claims_status" AS ENUM('PENDING', 'DELIVERED', 'CANCELLED');
  CREATE TYPE "public"."enum_notifications_template" AS ENUM('verification', 'winner-notification', 'admin-alert');
  CREATE TYPE "public"."enum_notifications_status" AS ENUM('created', 'queued', 'locked', 'sending', 'provider-accepted', 'sent', 'delivered', 'read', 'retry-scheduled', 'failed', 'dead-letter');
  CREATE TYPE "public"."enum_notification_audit_event_type" AS ENUM('notification_transition', 'recovery_bulk', 'worker_startup');
  CREATE TABLE "users_sessions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"created_at" timestamp(3) with time zone,
  	"expires_at" timestamp(3) with time zone NOT NULL
  );
  
  CREATE TABLE "users" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"role" "enum_users_role" DEFAULT 'STAFF' NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"email" varchar NOT NULL,
  	"reset_password_token" varchar,
  	"reset_password_expiration" timestamp(3) with time zone,
  	"salt" varchar,
  	"hash" varchar,
  	"login_attempts" numeric DEFAULT 0,
  	"lock_until" timestamp(3) with time zone
  );
  
  CREATE TABLE "prizes" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"quantity" numeric NOT NULL,
  	"description" varchar,
  	"image_id" integer,
  	"active" boolean DEFAULT true NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "codes" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"serial_code" varchar NOT NULL,
  	"is_winner" boolean DEFAULT false NOT NULL,
  	"prize_id_id" integer,
  	"claimed" boolean DEFAULT false NOT NULL,
  	"claimed_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "participants" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"phone" varchar NOT NULL,
  	"verified" boolean DEFAULT false,
  	"verified_at" timestamp(3) with time zone,
  	"verification_method" "enum_participants_verification_method",
  	"blocked" boolean DEFAULT false,
  	"blocked_reason" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "entries" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"participant_id" integer NOT NULL,
  	"code_id" integer,
  	"result" "enum_entries_result" NOT NULL,
  	"ip" varchar,
  	"user_agent" varchar,
  	"request_id" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "prize_claims" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"entry_id" integer NOT NULL,
  	"verification_code" varchar NOT NULL,
  	"status" "enum_prize_claims_status" DEFAULT 'PENDING' NOT NULL,
  	"verified" boolean DEFAULT false NOT NULL,
  	"verified_by_id" integer,
  	"verified_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "media" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"alt" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"url" varchar,
  	"thumbnail_u_r_l" varchar,
  	"filename" varchar,
  	"mime_type" varchar,
  	"filesize" numeric,
  	"width" numeric,
  	"height" numeric,
  	"focal_x" numeric,
  	"focal_y" numeric,
  	"sizes_thumbnail_url" varchar,
  	"sizes_thumbnail_width" numeric,
  	"sizes_thumbnail_height" numeric,
  	"sizes_thumbnail_mime_type" varchar,
  	"sizes_thumbnail_filesize" numeric,
  	"sizes_thumbnail_filename" varchar
  );
  
  CREATE TABLE "notifications" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"phone" varchar NOT NULL,
  	"template" "enum_notifications_template" NOT NULL,
  	"payload" jsonb NOT NULL,
  	"message" varchar,
  	"status" "enum_notifications_status" DEFAULT 'queued' NOT NULL,
  	"priority" numeric DEFAULT 80 NOT NULL,
  	"attempts" numeric DEFAULT 0 NOT NULL,
  	"max_attempts" numeric DEFAULT 5 NOT NULL,
  	"next_attempt_at" timestamp(3) with time zone,
  	"expires_at" timestamp(3) with time zone,
  	"locked_at" timestamp(3) with time zone,
  	"locked_by" varchar,
  	"lease_expires_at" timestamp(3) with time zone,
  	"last_error" varchar,
  	"sent_at" timestamp(3) with time zone,
  	"delivered_at" timestamp(3) with time zone,
  	"read_at" timestamp(3) with time zone,
  	"provider_message_id" varchar,
  	"provider_name" varchar,
  	"idempotency_key" varchar,
  	"send_duration_ms" numeric,
  	"delivery_payload" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "notification_audit" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"event_type" "enum_notification_audit_event_type" DEFAULT 'notification_transition' NOT NULL,
  	"notification_id" integer,
  	"from_status" varchar,
  	"to_status" varchar,
  	"actor" varchar NOT NULL,
  	"error" varchar,
  	"metadata" jsonb,
  	"provider_response" jsonb,
  	"duration_ms" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "otp_verifications" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"phone" varchar NOT NULL,
  	"code" varchar NOT NULL,
  	"expires_at" timestamp(3) with time zone NOT NULL,
  	"used" boolean DEFAULT false,
  	"used_at" timestamp(3) with time zone,
  	"last_sent_at" timestamp(3) with time zone NOT NULL,
  	"attempts" numeric DEFAULT 0,
  	"ip" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_kv" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"data" jsonb NOT NULL
  );
  
  CREATE TABLE "payload_locked_documents" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"global_slug" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_locked_documents_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer,
  	"prizes_id" integer,
  	"codes_id" integer,
  	"participants_id" integer,
  	"entries_id" integer,
  	"prize_claims_id" integer,
  	"media_id" integer,
  	"notifications_id" integer,
  	"notification_audit_id" integer,
  	"otp_verifications_id" integer
  );
  
  CREATE TABLE "payload_preferences" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar,
  	"value" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_preferences_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer
  );
  
  CREATE TABLE "payload_migrations" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"batch" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "settings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"whatsapp_admin_phone" varchar,
  	"enable_email_alerts" boolean DEFAULT true,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  ALTER TABLE "users_sessions" ADD CONSTRAINT "users_sessions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "prizes" ADD CONSTRAINT "prizes_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "codes" ADD CONSTRAINT "codes_prize_id_id_prizes_id_fk" FOREIGN KEY ("prize_id_id") REFERENCES "public"."prizes"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "entries" ADD CONSTRAINT "entries_participant_id_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "entries" ADD CONSTRAINT "entries_code_id_codes_id_fk" FOREIGN KEY ("code_id") REFERENCES "public"."codes"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "prize_claims" ADD CONSTRAINT "prize_claims_entry_id_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."entries"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "prize_claims" ADD CONSTRAINT "prize_claims_verified_by_id_users_id_fk" FOREIGN KEY ("verified_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "notification_audit" ADD CONSTRAINT "notification_audit_notification_id_notifications_id_fk" FOREIGN KEY ("notification_id") REFERENCES "public"."notifications"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_locked_documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_prizes_fk" FOREIGN KEY ("prizes_id") REFERENCES "public"."prizes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_codes_fk" FOREIGN KEY ("codes_id") REFERENCES "public"."codes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_participants_fk" FOREIGN KEY ("participants_id") REFERENCES "public"."participants"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_entries_fk" FOREIGN KEY ("entries_id") REFERENCES "public"."entries"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_prize_claims_fk" FOREIGN KEY ("prize_claims_id") REFERENCES "public"."prize_claims"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_notifications_fk" FOREIGN KEY ("notifications_id") REFERENCES "public"."notifications"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_notification_audit_fk" FOREIGN KEY ("notification_audit_id") REFERENCES "public"."notification_audit"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_otp_verifications_fk" FOREIGN KEY ("otp_verifications_id") REFERENCES "public"."otp_verifications"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_preferences"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "users_sessions_order_idx" ON "users_sessions" USING btree ("_order");
  CREATE INDEX "users_sessions_parent_id_idx" ON "users_sessions" USING btree ("_parent_id");
  CREATE INDEX "users_updated_at_idx" ON "users" USING btree ("updated_at");
  CREATE INDEX "users_created_at_idx" ON "users" USING btree ("created_at");
  CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");
  CREATE INDEX "prizes_image_idx" ON "prizes" USING btree ("image_id");
  CREATE INDEX "prizes_updated_at_idx" ON "prizes" USING btree ("updated_at");
  CREATE INDEX "prizes_created_at_idx" ON "prizes" USING btree ("created_at");
  CREATE UNIQUE INDEX "codes_serial_code_idx" ON "codes" USING btree ("serial_code");
  CREATE INDEX "codes_is_winner_idx" ON "codes" USING btree ("is_winner");
  CREATE INDEX "codes_prize_id_idx" ON "codes" USING btree ("prize_id_id");
  CREATE INDEX "codes_claimed_idx" ON "codes" USING btree ("claimed");
  CREATE INDEX "codes_updated_at_idx" ON "codes" USING btree ("updated_at");
  CREATE INDEX "codes_created_at_idx" ON "codes" USING btree ("created_at");
  CREATE INDEX "participants_name_idx" ON "participants" USING btree ("name");
  CREATE UNIQUE INDEX "participants_phone_idx" ON "participants" USING btree ("phone");
  CREATE INDEX "participants_verified_idx" ON "participants" USING btree ("verified");
  CREATE INDEX "participants_blocked_idx" ON "participants" USING btree ("blocked");
  CREATE INDEX "participants_updated_at_idx" ON "participants" USING btree ("updated_at");
  CREATE INDEX "participants_created_at_idx" ON "participants" USING btree ("created_at");
  CREATE INDEX "entries_participant_idx" ON "entries" USING btree ("participant_id");
  CREATE INDEX "entries_code_idx" ON "entries" USING btree ("code_id");
  CREATE INDEX "entries_result_idx" ON "entries" USING btree ("result");
  CREATE INDEX "entries_request_id_idx" ON "entries" USING btree ("request_id");
  CREATE INDEX "entries_updated_at_idx" ON "entries" USING btree ("updated_at");
  CREATE INDEX "entries_created_at_idx" ON "entries" USING btree ("created_at");
  CREATE UNIQUE INDEX "prize_claims_entry_idx" ON "prize_claims" USING btree ("entry_id");
  CREATE UNIQUE INDEX "prize_claims_verification_code_idx" ON "prize_claims" USING btree ("verification_code");
  CREATE INDEX "prize_claims_status_idx" ON "prize_claims" USING btree ("status");
  CREATE INDEX "prize_claims_verified_idx" ON "prize_claims" USING btree ("verified");
  CREATE INDEX "prize_claims_verified_by_idx" ON "prize_claims" USING btree ("verified_by_id");
  CREATE INDEX "prize_claims_updated_at_idx" ON "prize_claims" USING btree ("updated_at");
  CREATE INDEX "prize_claims_created_at_idx" ON "prize_claims" USING btree ("created_at");
  CREATE INDEX "media_updated_at_idx" ON "media" USING btree ("updated_at");
  CREATE INDEX "media_created_at_idx" ON "media" USING btree ("created_at");
  CREATE UNIQUE INDEX "media_filename_idx" ON "media" USING btree ("filename");
  CREATE INDEX "media_sizes_thumbnail_sizes_thumbnail_filename_idx" ON "media" USING btree ("sizes_thumbnail_filename");
  CREATE INDEX "notifications_phone_idx" ON "notifications" USING btree ("phone");
  CREATE INDEX "notifications_template_idx" ON "notifications" USING btree ("template");
  CREATE INDEX "notifications_status_idx" ON "notifications" USING btree ("status");
  CREATE INDEX "notifications_priority_idx" ON "notifications" USING btree ("priority");
  CREATE INDEX "notifications_next_attempt_at_idx" ON "notifications" USING btree ("next_attempt_at");
  CREATE INDEX "notifications_expires_at_idx" ON "notifications" USING btree ("expires_at");
  CREATE INDEX "notifications_lease_expires_at_idx" ON "notifications" USING btree ("lease_expires_at");
  CREATE INDEX "notifications_provider_message_id_idx" ON "notifications" USING btree ("provider_message_id");
  CREATE UNIQUE INDEX "notifications_idempotency_key_idx" ON "notifications" USING btree ("idempotency_key");
  CREATE INDEX "notifications_updated_at_idx" ON "notifications" USING btree ("updated_at");
  CREATE INDEX "notifications_created_at_idx" ON "notifications" USING btree ("created_at");
  CREATE INDEX "notification_audit_event_type_idx" ON "notification_audit" USING btree ("event_type");
  CREATE INDEX "notification_audit_notification_idx" ON "notification_audit" USING btree ("notification_id");
  CREATE INDEX "notification_audit_updated_at_idx" ON "notification_audit" USING btree ("updated_at");
  CREATE INDEX "notification_audit_created_at_idx" ON "notification_audit" USING btree ("created_at");
  CREATE INDEX "otp_verifications_phone_idx" ON "otp_verifications" USING btree ("phone");
  CREATE INDEX "otp_verifications_expires_at_idx" ON "otp_verifications" USING btree ("expires_at");
  CREATE INDEX "otp_verifications_used_idx" ON "otp_verifications" USING btree ("used");
  CREATE INDEX "otp_verifications_updated_at_idx" ON "otp_verifications" USING btree ("updated_at");
  CREATE INDEX "otp_verifications_created_at_idx" ON "otp_verifications" USING btree ("created_at");
  CREATE UNIQUE INDEX "payload_kv_key_idx" ON "payload_kv" USING btree ("key");
  CREATE INDEX "payload_locked_documents_global_slug_idx" ON "payload_locked_documents" USING btree ("global_slug");
  CREATE INDEX "payload_locked_documents_updated_at_idx" ON "payload_locked_documents" USING btree ("updated_at");
  CREATE INDEX "payload_locked_documents_created_at_idx" ON "payload_locked_documents" USING btree ("created_at");
  CREATE INDEX "payload_locked_documents_rels_order_idx" ON "payload_locked_documents_rels" USING btree ("order");
  CREATE INDEX "payload_locked_documents_rels_parent_idx" ON "payload_locked_documents_rels" USING btree ("parent_id");
  CREATE INDEX "payload_locked_documents_rels_path_idx" ON "payload_locked_documents_rels" USING btree ("path");
  CREATE INDEX "payload_locked_documents_rels_users_id_idx" ON "payload_locked_documents_rels" USING btree ("users_id");
  CREATE INDEX "payload_locked_documents_rels_prizes_id_idx" ON "payload_locked_documents_rels" USING btree ("prizes_id");
  CREATE INDEX "payload_locked_documents_rels_codes_id_idx" ON "payload_locked_documents_rels" USING btree ("codes_id");
  CREATE INDEX "payload_locked_documents_rels_participants_id_idx" ON "payload_locked_documents_rels" USING btree ("participants_id");
  CREATE INDEX "payload_locked_documents_rels_entries_id_idx" ON "payload_locked_documents_rels" USING btree ("entries_id");
  CREATE INDEX "payload_locked_documents_rels_prize_claims_id_idx" ON "payload_locked_documents_rels" USING btree ("prize_claims_id");
  CREATE INDEX "payload_locked_documents_rels_media_id_idx" ON "payload_locked_documents_rels" USING btree ("media_id");
  CREATE INDEX "payload_locked_documents_rels_notifications_id_idx" ON "payload_locked_documents_rels" USING btree ("notifications_id");
  CREATE INDEX "payload_locked_documents_rels_notification_audit_id_idx" ON "payload_locked_documents_rels" USING btree ("notification_audit_id");
  CREATE INDEX "payload_locked_documents_rels_otp_verifications_id_idx" ON "payload_locked_documents_rels" USING btree ("otp_verifications_id");
  CREATE INDEX "payload_preferences_key_idx" ON "payload_preferences" USING btree ("key");
  CREATE INDEX "payload_preferences_updated_at_idx" ON "payload_preferences" USING btree ("updated_at");
  CREATE INDEX "payload_preferences_created_at_idx" ON "payload_preferences" USING btree ("created_at");
  CREATE INDEX "payload_preferences_rels_order_idx" ON "payload_preferences_rels" USING btree ("order");
  CREATE INDEX "payload_preferences_rels_parent_idx" ON "payload_preferences_rels" USING btree ("parent_id");
  CREATE INDEX "payload_preferences_rels_path_idx" ON "payload_preferences_rels" USING btree ("path");
  CREATE INDEX "payload_preferences_rels_users_id_idx" ON "payload_preferences_rels" USING btree ("users_id");
  CREATE INDEX "payload_migrations_updated_at_idx" ON "payload_migrations" USING btree ("updated_at");
  CREATE INDEX "payload_migrations_created_at_idx" ON "payload_migrations" USING btree ("created_at");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "users_sessions" CASCADE;
  DROP TABLE "users" CASCADE;
  DROP TABLE "prizes" CASCADE;
  DROP TABLE "codes" CASCADE;
  DROP TABLE "participants" CASCADE;
  DROP TABLE "entries" CASCADE;
  DROP TABLE "prize_claims" CASCADE;
  DROP TABLE "media" CASCADE;
  DROP TABLE "notifications" CASCADE;
  DROP TABLE "notification_audit" CASCADE;
  DROP TABLE "otp_verifications" CASCADE;
  DROP TABLE "payload_kv" CASCADE;
  DROP TABLE "payload_locked_documents" CASCADE;
  DROP TABLE "payload_locked_documents_rels" CASCADE;
  DROP TABLE "payload_preferences" CASCADE;
  DROP TABLE "payload_preferences_rels" CASCADE;
  DROP TABLE "payload_migrations" CASCADE;
  DROP TABLE "settings" CASCADE;
  DROP TYPE "public"."enum_users_role";
  DROP TYPE "public"."enum_participants_verification_method";
  DROP TYPE "public"."enum_entries_result";
  DROP TYPE "public"."enum_prize_claims_status";
  DROP TYPE "public"."enum_notifications_template";
  DROP TYPE "public"."enum_notifications_status";
  DROP TYPE "public"."enum_notification_audit_event_type";`)
}
