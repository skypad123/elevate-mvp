CREATE EXTENSION IF NOT EXISTS citext;
--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS pg_trgm;
--> statement-breakpoint
CREATE TYPE "artefact_type" AS ENUM('video', 'audio', 'text', 'quiz');--> statement-breakpoint
CREATE TYPE "audience" AS ENUM('learner', 'teach', 'support');--> statement-breakpoint
CREATE TYPE "change_set_status" AS ENUM('open', 'approved', 'discarded');--> statement-breakpoint
CREATE TYPE "course_status" AS ENUM('draft', 'pending_review', 'live', 'rejected');--> statement-breakpoint
CREATE TYPE "enrollment_mode" AS ENUM('self_directed', 'class_based');--> statement-breakpoint
CREATE TYPE "enrollment_status" AS ENUM('pending_payment', 'active', 'refunded', 'cancelled');--> statement-breakpoint
CREATE TYPE "entity_check_status" AS ENUM('pending', 'verified', 'rejected');--> statement-breakpoint
CREATE TYPE "entity_type" AS ENUM('private_limited', 'llp');--> statement-breakpoint
CREATE TYPE "identity_provider" AS ENUM('email', 'singpass');--> statement-breakpoint
CREATE TYPE "invitation_status" AS ENUM('pending', 'awaiting_confirmation', 'accepted', 'revoked', 'expired');--> statement-breakpoint
CREATE TYPE "media_kind" AS ENUM('video', 'audio', 'image', 'document');--> statement-breakpoint
CREATE TYPE "media_provider" AS ENUM('local', 'mux', 's3');--> statement-breakpoint
CREATE TYPE "media_status" AS ENUM('pending', 'processing', 'ready', 'errored');--> statement-breakpoint
CREATE TYPE "membership_role" AS ENUM('manager', 'writer');--> statement-breakpoint
CREATE TYPE "payment_status" AS ENUM('succeeded', 'refunded', 'partially_refunded');--> statement-breakpoint
CREATE TYPE "payout_account_status" AS ENUM('onboarding', 'active');--> statement-breakpoint
CREATE TYPE "profile_status" AS ENUM('applied', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "profile_type" AS ENUM('personal', 'corporate');--> statement-breakpoint
CREATE TYPE "progress_status" AS ENUM('not_started', 'in_progress', 'completed');--> statement-breakpoint
CREATE TYPE "promo_type" AS ENUM('percent', 'fixed');--> statement-breakpoint
CREATE TYPE "stripe_business_type" AS ENUM('individual', 'company');--> statement-breakpoint
CREATE TYPE "user_role" AS ENUM('support_agent', 'super_admin');--> statement-breakpoint
CREATE TYPE "webhook_provider" AS ENUM('stripe', 'mux');--> statement-breakpoint
CREATE TABLE "identities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" uuid NOT NULL,
	"provider" "identity_provider" NOT NULL,
	"provider_subject" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "identities_provider_provider_subject_unique" UNIQUE("provider","provider_subject")
);
--> statement-breakpoint
CREATE TABLE "magic_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"email" citext NOT NULL,
	"audience" "audience" NOT NULL,
	"token_hash" text NOT NULL UNIQUE,
	"code_hash" text NOT NULL,
	"redirect_path" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL UNIQUE,
	"audience" "audience" NOT NULL,
	"user_agent" text,
	"expires_at" timestamp with time zone NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_roles" (
	"user_id" uuid,
	"role" "user_role",
	"granted_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_roles_pkey" PRIMARY KEY("user_id","role")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"email" citext NOT NULL UNIQUE,
	"name" text,
	"avatar_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "enrollments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" uuid NOT NULL,
	"course_id" uuid NOT NULL,
	"mode" "enrollment_mode" DEFAULT 'self_directed'::"enrollment_mode" NOT NULL,
	"status" "enrollment_status" DEFAULT 'pending_payment'::"enrollment_status" NOT NULL,
	"attendance_records" jsonb DEFAULT '[]' NOT NULL,
	"promo_code_id" uuid,
	"stripe_checkout_session_id" text UNIQUE,
	"enrolled_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "enrollments_user_id_course_id_unique" UNIQUE("user_id","course_id")
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"enrollment_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"course_id" uuid NOT NULL,
	"profile_id" uuid NOT NULL,
	"payout_account_id" uuid NOT NULL,
	"stripe_checkout_session_id" text NOT NULL UNIQUE,
	"stripe_payment_intent_id" text UNIQUE,
	"stripe_charge_id" text,
	"stripe_transfer_id" text,
	"stripe_application_fee_id" text,
	"stripe_balance_transaction_id" text,
	"currency" text DEFAULT 'sgd' NOT NULL,
	"list_price_cents" integer NOT NULL,
	"discount_cents" integer DEFAULT 0 NOT NULL,
	"amount_cents" integer NOT NULL,
	"stripe_fee_estimate_cents" integer NOT NULL,
	"stripe_fee_actual_cents" integer,
	"commission_cents" integer NOT NULL,
	"application_fee_cents" integer NOT NULL,
	"teacher_net_cents" integer NOT NULL,
	"platform_net_cents" integer,
	"promo_code_id" uuid,
	"status" "payment_status" DEFAULT 'succeeded'::"payment_status" NOT NULL,
	"refunded_cents" integer DEFAULT 0 NOT NULL,
	"receipt_url" text,
	"paid_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "promo_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"code" citext NOT NULL UNIQUE,
	"type" "promo_type" NOT NULL,
	"value" integer NOT NULL,
	"course_id" uuid,
	"max_redemptions" integer,
	"redeemed_count" integer DEFAULT 0 NOT NULL,
	"starts_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"active" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "refunds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"payment_id" uuid NOT NULL,
	"stripe_refund_id" text NOT NULL UNIQUE,
	"amount_cents" integer NOT NULL,
	"reason" text,
	"requested_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "artefacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"lesson_id" uuid NOT NULL,
	"type" "artefact_type" NOT NULL,
	"title" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"media_asset_id" uuid,
	"content_json" jsonb,
	"duration_seconds" integer,
	"change_set_id" uuid,
	"source_id" uuid,
	"removed" boolean DEFAULT false NOT NULL,
	"copied_from_live" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "artefacts_live_row_is_clean" CHECK ("change_set_id" is not null or ("source_id" is null and not "removed" and not "copied_from_live"))
);
--> statement-breakpoint
CREATE TABLE "course_change_sets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"course_id" uuid NOT NULL,
	"opened_by" uuid,
	"status" "change_set_status" DEFAULT 'open'::"change_set_status" NOT NULL,
	"opened_at" timestamp with time zone DEFAULT now() NOT NULL,
	"opened_at_snapshot" timestamp with time zone NOT NULL,
	"opened_prerequisites" jsonb DEFAULT '[]' NOT NULL,
	"opened_fingerprints" jsonb DEFAULT '{}' NOT NULL,
	"resolutions" jsonb DEFAULT '[]' NOT NULL,
	"decided_by" uuid,
	"decided_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "courses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"profile_id" uuid NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL UNIQUE,
	"summary" text,
	"description_json" jsonb,
	"category" text NOT NULL,
	"thumbnail_media_id" uuid,
	"price_cents" integer DEFAULT 0 NOT NULL,
	"currency" text DEFAULT 'sgd' NOT NULL,
	"status" "course_status" DEFAULT 'draft'::"course_status" NOT NULL,
	"rejection_reason" text,
	"scheme_status" text,
	"scheme_type" text,
	"submitted_at" timestamp with time zone,
	"reviewed_at" timestamp with time zone,
	"reviewed_by" uuid,
	"published_at" timestamp with time zone,
	"enrol_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "courses_price_cents_non_negative" CHECK ("price_cents" >= 0)
);
--> statement-breakpoint
CREATE TABLE "lesson_prerequisites" (
	"lesson_id" uuid,
	"prerequisite_lesson_id" uuid,
	"change_set_id" uuid,
	CONSTRAINT "lesson_prerequisites_pkey" PRIMARY KEY("lesson_id","prerequisite_lesson_id"),
	CONSTRAINT "lesson_prerequisites_not_self" CHECK ("lesson_id" <> "prerequisite_lesson_id")
);
--> statement-breakpoint
CREATE TABLE "lessons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"course_id" uuid NOT NULL,
	"title" text NOT NULL,
	"summary" text,
	"position" integer DEFAULT 0 NOT NULL,
	"change_set_id" uuid,
	"source_id" uuid,
	"removed" boolean DEFAULT false NOT NULL,
	"copied_from_live" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lessons_live_row_is_clean" CHECK ("change_set_id" is not null or ("source_id" is null and not "removed" and not "copied_from_live"))
);
--> statement-breakpoint
CREATE TABLE "quizzes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"artefact_id" uuid NOT NULL UNIQUE,
	"pass_mark_percent" integer DEFAULT 70 NOT NULL,
	"max_attempts" integer DEFAULT 1 NOT NULL,
	"time_limit_minutes" integer,
	"questions_json" jsonb DEFAULT '[]' NOT NULL,
	"change_set_id" uuid,
	"source_id" uuid,
	"removed" boolean DEFAULT false NOT NULL,
	"copied_from_live" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quizzes_live_row_is_clean" CHECK ("change_set_id" is not null or ("source_id" is null and not "removed" and not "copied_from_live"))
);
--> statement-breakpoint
CREATE TABLE "artefact_progress" (
	"enrollment_id" uuid,
	"artefact_id" uuid,
	"status" "progress_status" DEFAULT 'not_started'::"progress_status" NOT NULL,
	"position_seconds" integer DEFAULT 0 NOT NULL,
	"completed_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "artefact_progress_pkey" PRIMARY KEY("enrollment_id","artefact_id")
);
--> statement-breakpoint
CREATE TABLE "certificates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"enrollment_id" uuid NOT NULL UNIQUE,
	"token" text NOT NULL UNIQUE,
	"pdf_storage_key" text,
	"learner_name" text NOT NULL,
	"course_title" text NOT NULL,
	"teacher_name" text NOT NULL,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "quiz_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"enrollment_id" uuid NOT NULL,
	"quiz_id" uuid NOT NULL,
	"answers_json" jsonb DEFAULT '{}' NOT NULL,
	"score_percent" integer,
	"passed" boolean,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"submitted_at" timestamp with time zone,
	"expires_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "media_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"uploader_id" uuid,
	"profile_id" uuid,
	"kind" "media_kind" NOT NULL,
	"provider" "media_provider" NOT NULL,
	"status" "media_status" DEFAULT 'pending'::"media_status" NOT NULL,
	"provider_upload_id" text,
	"provider_asset_id" text,
	"playback_id" text,
	"storage_key" text,
	"filename" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" bigint,
	"duration_seconds" integer,
	"width" integer,
	"height" integer,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "legal_entities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"uen" text NOT NULL UNIQUE,
	"legal_name" text NOT NULL,
	"entity_type" "entity_type" NOT NULL,
	"registry_document_media_id" uuid,
	"check_status" "entity_check_status" DEFAULT 'pending'::"entity_check_status" NOT NULL,
	"checked_by" uuid,
	"checked_at" timestamp with time zone,
	"rejection_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payout_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"profile_id" uuid NOT NULL UNIQUE,
	"stripe_account_id" text UNIQUE,
	"business_type" "stripe_business_type" NOT NULL,
	"status" "payout_account_status" DEFAULT 'onboarding'::"payout_account_status" NOT NULL,
	"details_submitted" boolean DEFAULT false NOT NULL,
	"charges_enabled" boolean DEFAULT false NOT NULL,
	"payouts_enabled" boolean DEFAULT false NOT NULL,
	"activated_at" timestamp with time zone,
	"name_verified_by" uuid,
	"name_verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profile_invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"profile_id" uuid NOT NULL,
	"email" citext NOT NULL,
	"role" "membership_role" NOT NULL,
	"invited_by" uuid,
	"token_hash" text NOT NULL UNIQUE,
	"status" "invitation_status" DEFAULT 'pending'::"invitation_status" NOT NULL,
	"accepted_by" uuid,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profile_memberships" (
	"profile_id" uuid,
	"user_id" uuid,
	"role" "membership_role" NOT NULL,
	"added_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profile_memberships_pkey" PRIMARY KEY("profile_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"type" "profile_type" NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"display_name" text NOT NULL,
	"headline" text,
	"bio" text,
	"credentials" text,
	"teaching_sample_url" text,
	"teaching_sample_media_id" uuid,
	"avatar_media_id" uuid,
	"legal_entity_id" uuid UNIQUE,
	"status" "profile_status" DEFAULT 'applied'::"profile_status" NOT NULL,
	"review_note" text,
	"commission_bps" integer DEFAULT 1500 NOT NULL,
	"applied_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_at" timestamp with time zone,
	"reviewed_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profiles_commission_bps_range" CHECK ("commission_bps" between 0 and 10000),
	CONSTRAINT "profiles_corporate_has_legal_entity" CHECK (("type" = 'corporate') = ("legal_entity_id" is not null))
);
--> statement-breakpoint
CREATE TABLE "analytics_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" uuid,
	"name" text NOT NULL,
	"properties" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"actor_id" uuid,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text,
	"profile_id" uuid,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"provider" "webhook_provider",
	"event_id" text,
	"type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"error" text,
	CONSTRAINT "webhook_events_pkey" PRIMARY KEY("provider","event_id")
);
--> statement-breakpoint
CREATE INDEX "identities_user_id_index" ON "identities" ("user_id");--> statement-breakpoint
CREATE INDEX "magic_links_email_created_at_index" ON "magic_links" ("email","created_at");--> statement-breakpoint
CREATE INDEX "sessions_user_id_index" ON "sessions" ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_expires_at_index" ON "sessions" ("expires_at");--> statement-breakpoint
CREATE INDEX "enrollments_course_id_status_index" ON "enrollments" ("course_id","status");--> statement-breakpoint
CREATE INDEX "enrollments_user_id_status_index" ON "enrollments" ("user_id","status");--> statement-breakpoint
CREATE INDEX "payments_profile_id_paid_at_index" ON "payments" ("profile_id","paid_at");--> statement-breakpoint
CREATE INDEX "payments_payout_account_id_paid_at_index" ON "payments" ("payout_account_id","paid_at");--> statement-breakpoint
CREATE INDEX "payments_course_id_index" ON "payments" ("course_id");--> statement-breakpoint
CREATE INDEX "payments_user_id_index" ON "payments" ("user_id");--> statement-breakpoint
CREATE INDEX "payments_paid_at_index" ON "payments" ("paid_at");--> statement-breakpoint
CREATE INDEX "payments_status_paid_at_index" ON "payments" ("status","paid_at");--> statement-breakpoint
CREATE INDEX "artefacts_lesson_id_position_index" ON "artefacts" ("lesson_id","position");--> statement-breakpoint
CREATE INDEX "artefacts_change_set_id_index" ON "artefacts" ("change_set_id");--> statement-breakpoint
CREATE INDEX "artefacts_source_id_index" ON "artefacts" ("source_id");--> statement-breakpoint
CREATE UNIQUE INDEX "course_change_sets_one_open_per_course" ON "course_change_sets" ("course_id") WHERE "status" = 'open';--> statement-breakpoint
CREATE INDEX "course_change_sets_course_id_index" ON "course_change_sets" ("course_id");--> statement-breakpoint
CREATE INDEX "courses_profile_id_index" ON "courses" ("profile_id");--> statement-breakpoint
CREATE INDEX "courses_status_published_at_index" ON "courses" ("status","published_at");--> statement-breakpoint
CREATE INDEX "courses_status_enrol_count_index" ON "courses" ("status","enrol_count");--> statement-breakpoint
CREATE INDEX "lesson_prerequisites_change_set_id_index" ON "lesson_prerequisites" ("change_set_id");--> statement-breakpoint
CREATE INDEX "lessons_course_id_position_index" ON "lessons" ("course_id","position");--> statement-breakpoint
CREATE INDEX "lessons_change_set_id_index" ON "lessons" ("change_set_id");--> statement-breakpoint
CREATE INDEX "lessons_source_id_index" ON "lessons" ("source_id");--> statement-breakpoint
CREATE INDEX "quizzes_change_set_id_index" ON "quizzes" ("change_set_id");--> statement-breakpoint
CREATE INDEX "quizzes_source_id_index" ON "quizzes" ("source_id");--> statement-breakpoint
CREATE INDEX "artefact_progress_enrollment_id_updated_at_index" ON "artefact_progress" ("enrollment_id","updated_at");--> statement-breakpoint
CREATE INDEX "quiz_attempts_enrollment_id_quiz_id_index" ON "quiz_attempts" ("enrollment_id","quiz_id");--> statement-breakpoint
CREATE INDEX "media_assets_uploader_id_index" ON "media_assets" ("uploader_id");--> statement-breakpoint
CREATE INDEX "media_assets_profile_id_index" ON "media_assets" ("profile_id");--> statement-breakpoint
CREATE INDEX "media_assets_provider_upload_id_index" ON "media_assets" ("provider_upload_id");--> statement-breakpoint
CREATE INDEX "media_assets_provider_asset_id_index" ON "media_assets" ("provider_asset_id");--> statement-breakpoint
CREATE UNIQUE INDEX "profile_invitations_one_pending_per_email" ON "profile_invitations" ("profile_id","email") WHERE "status" = 'pending';--> statement-breakpoint
CREATE INDEX "profile_invitations_profile_id_created_at_index" ON "profile_invitations" ("profile_id","created_at");--> statement-breakpoint
CREATE INDEX "profile_memberships_user_id_index" ON "profile_memberships" ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "profiles_one_personal_per_owner" ON "profiles" ("owner_user_id") WHERE "type" = 'personal';--> statement-breakpoint
CREATE INDEX "profiles_owner_user_id_index" ON "profiles" ("owner_user_id");--> statement-breakpoint
CREATE INDEX "analytics_events_name_created_at_index" ON "analytics_events" ("name","created_at");--> statement-breakpoint
CREATE INDEX "audit_log_entity_type_entity_id_index" ON "audit_log" ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "audit_log_profile_id_index" ON "audit_log" ("profile_id");--> statement-breakpoint
CREATE INDEX "audit_log_created_at_index" ON "audit_log" ("created_at");--> statement-breakpoint
ALTER TABLE "identities" ADD CONSTRAINT "identities_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_granted_by_users_id_fkey" FOREIGN KEY ("granted_by") REFERENCES "users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_course_id_courses_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_promo_code_id_promo_codes_id_fkey" FOREIGN KEY ("promo_code_id") REFERENCES "promo_codes"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_enrollment_id_enrollments_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "enrollments"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_course_id_courses_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_profile_id_profiles_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_payout_account_id_payout_accounts_id_fkey" FOREIGN KEY ("payout_account_id") REFERENCES "payout_accounts"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_promo_code_id_promo_codes_id_fkey" FOREIGN KEY ("promo_code_id") REFERENCES "promo_codes"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "promo_codes" ADD CONSTRAINT "promo_codes_course_id_courses_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "promo_codes" ADD CONSTRAINT "promo_codes_created_by_users_id_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_payment_id_payments_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_requested_by_users_id_fkey" FOREIGN KEY ("requested_by") REFERENCES "users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "artefacts" ADD CONSTRAINT "artefacts_lesson_id_lessons_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "artefacts" ADD CONSTRAINT "artefacts_media_asset_id_media_assets_id_fkey" FOREIGN KEY ("media_asset_id") REFERENCES "media_assets"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "artefacts" ADD CONSTRAINT "artefacts_change_set_id_course_change_sets_id_fkey" FOREIGN KEY ("change_set_id") REFERENCES "course_change_sets"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "artefacts" ADD CONSTRAINT "artefacts_source_id_artefacts_id_fkey" FOREIGN KEY ("source_id") REFERENCES "artefacts"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "course_change_sets" ADD CONSTRAINT "course_change_sets_course_id_courses_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "course_change_sets" ADD CONSTRAINT "course_change_sets_opened_by_users_id_fkey" FOREIGN KEY ("opened_by") REFERENCES "users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "course_change_sets" ADD CONSTRAINT "course_change_sets_decided_by_users_id_fkey" FOREIGN KEY ("decided_by") REFERENCES "users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "courses" ADD CONSTRAINT "courses_profile_id_profiles_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "courses" ADD CONSTRAINT "courses_thumbnail_media_id_media_assets_id_fkey" FOREIGN KEY ("thumbnail_media_id") REFERENCES "media_assets"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "courses" ADD CONSTRAINT "courses_reviewed_by_users_id_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "lesson_prerequisites" ADD CONSTRAINT "lesson_prerequisites_lesson_id_lessons_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "lesson_prerequisites" ADD CONSTRAINT "lesson_prerequisites_prerequisite_lesson_id_lessons_id_fkey" FOREIGN KEY ("prerequisite_lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "lesson_prerequisites" ADD CONSTRAINT "lesson_prerequisites_change_set_id_course_change_sets_id_fkey" FOREIGN KEY ("change_set_id") REFERENCES "course_change_sets"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_course_id_courses_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_change_set_id_course_change_sets_id_fkey" FOREIGN KEY ("change_set_id") REFERENCES "course_change_sets"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_source_id_lessons_id_fkey" FOREIGN KEY ("source_id") REFERENCES "lessons"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "quizzes" ADD CONSTRAINT "quizzes_artefact_id_artefacts_id_fkey" FOREIGN KEY ("artefact_id") REFERENCES "artefacts"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "quizzes" ADD CONSTRAINT "quizzes_change_set_id_course_change_sets_id_fkey" FOREIGN KEY ("change_set_id") REFERENCES "course_change_sets"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "quizzes" ADD CONSTRAINT "quizzes_source_id_quizzes_id_fkey" FOREIGN KEY ("source_id") REFERENCES "quizzes"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "artefact_progress" ADD CONSTRAINT "artefact_progress_enrollment_id_enrollments_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "enrollments"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "artefact_progress" ADD CONSTRAINT "artefact_progress_artefact_id_artefacts_id_fkey" FOREIGN KEY ("artefact_id") REFERENCES "artefacts"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_enrollment_id_enrollments_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "enrollments"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_enrollment_id_enrollments_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "enrollments"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_quiz_id_quizzes_id_fkey" FOREIGN KEY ("quiz_id") REFERENCES "quizzes"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_uploader_id_users_id_fkey" FOREIGN KEY ("uploader_id") REFERENCES "users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_profile_id_profiles_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "legal_entities" ADD CONSTRAINT "legal_entities_registry_document_media_id_media_assets_id_fkey" FOREIGN KEY ("registry_document_media_id") REFERENCES "media_assets"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "legal_entities" ADD CONSTRAINT "legal_entities_checked_by_users_id_fkey" FOREIGN KEY ("checked_by") REFERENCES "users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "payout_accounts" ADD CONSTRAINT "payout_accounts_profile_id_profiles_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "payout_accounts" ADD CONSTRAINT "payout_accounts_name_verified_by_users_id_fkey" FOREIGN KEY ("name_verified_by") REFERENCES "users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "profile_invitations" ADD CONSTRAINT "profile_invitations_profile_id_profiles_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "profile_invitations" ADD CONSTRAINT "profile_invitations_invited_by_users_id_fkey" FOREIGN KEY ("invited_by") REFERENCES "users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "profile_invitations" ADD CONSTRAINT "profile_invitations_accepted_by_users_id_fkey" FOREIGN KEY ("accepted_by") REFERENCES "users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "profile_memberships" ADD CONSTRAINT "profile_memberships_profile_id_profiles_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "profile_memberships" ADD CONSTRAINT "profile_memberships_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "profile_memberships" ADD CONSTRAINT "profile_memberships_added_by_users_id_fkey" FOREIGN KEY ("added_by") REFERENCES "users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_owner_user_id_users_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_teaching_sample_media_id_media_assets_id_fkey" FOREIGN KEY ("teaching_sample_media_id") REFERENCES "media_assets"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_avatar_media_id_media_assets_id_fkey" FOREIGN KEY ("avatar_media_id") REFERENCES "media_assets"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_legal_entity_id_legal_entities_id_fkey" FOREIGN KEY ("legal_entity_id") REFERENCES "legal_entities"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_reviewed_by_users_id_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_id_users_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_profile_id_profiles_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE SET NULL;--> statement-breakpoint
CREATE VIEW "live_artefacts" AS (select "id", "lesson_id", "type", "title", "position", "media_asset_id", "content_json", "duration_seconds", "change_set_id", "source_id", "removed", "copied_from_live", "created_at", "updated_at" from "artefacts" where ("artefacts"."change_set_id" is null));--> statement-breakpoint
CREATE VIEW "live_lesson_prerequisites" AS (select "lesson_id", "prerequisite_lesson_id", "change_set_id" from "lesson_prerequisites" where ("lesson_prerequisites"."change_set_id" is null));--> statement-breakpoint
CREATE VIEW "live_lessons" AS (select "id", "course_id", "title", "summary", "position", "change_set_id", "source_id", "removed", "copied_from_live", "created_at", "updated_at" from "lessons" where ("lessons"."change_set_id" is null));--> statement-breakpoint
CREATE VIEW "live_quizzes" AS (select "id", "artefact_id", "pass_mark_percent", "max_attempts", "time_limit_minutes", "questions_json", "change_set_id", "source_id", "removed", "copied_from_live", "created_at", "updated_at" from "quizzes" where ("quizzes"."change_set_id" is null));