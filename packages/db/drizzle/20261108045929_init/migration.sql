CREATE EXTENSION IF NOT EXISTS citext;
--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS pg_trgm;
--> statement-breakpoint
CREATE TYPE "public"."artefact_type" AS ENUM('video', 'audio', 'text', 'quiz');--> statement-breakpoint
CREATE TYPE "public"."audience" AS ENUM('learner', 'teach', 'support');--> statement-breakpoint
CREATE TYPE "public"."course_status" AS ENUM('draft', 'pending_review', 'live', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."enrollment_mode" AS ENUM('self_directed', 'class_based');--> statement-breakpoint
CREATE TYPE "public"."enrollment_status" AS ENUM('pending_payment', 'active', 'refunded', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."identity_provider" AS ENUM('email', 'singpass');--> statement-breakpoint
CREATE TYPE "public"."media_kind" AS ENUM('video', 'audio', 'image', 'document');--> statement-breakpoint
CREATE TYPE "public"."media_provider" AS ENUM('local', 'mux', 's3');--> statement-breakpoint
CREATE TYPE "public"."media_status" AS ENUM('pending', 'processing', 'ready', 'errored');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('succeeded', 'refunded', 'partially_refunded');--> statement-breakpoint
CREATE TYPE "public"."progress_status" AS ENUM('not_started', 'in_progress', 'completed');--> statement-breakpoint
CREATE TYPE "public"."promo_type" AS ENUM('percent', 'fixed');--> statement-breakpoint
CREATE TYPE "public"."teacher_status" AS ENUM('applied', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('teacher', 'support_agent', 'super_admin');--> statement-breakpoint
CREATE TYPE "public"."webhook_provider" AS ENUM('stripe', 'mux');--> statement-breakpoint
CREATE TABLE "identities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" "identity_provider" NOT NULL,
	"provider_subject" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "identities_provider_providerSubject_unique" UNIQUE("provider","provider_subject")
);
--> statement-breakpoint
CREATE TABLE "magic_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" "citext" NOT NULL,
	"audience" "audience" NOT NULL,
	"token_hash" text NOT NULL,
	"code_hash" text NOT NULL,
	"redirect_path" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "magic_links_tokenHash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"audience" "audience" NOT NULL,
	"user_agent" text,
	"expires_at" timestamp with time zone NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_tokenHash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "user_roles" (
	"user_id" uuid NOT NULL,
	"role" "user_role" NOT NULL,
	"granted_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_roles_user_id_role_pk" PRIMARY KEY("user_id","role")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" "citext" NOT NULL,
	"name" text,
	"avatar_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "enrollments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"course_id" uuid NOT NULL,
	"mode" "enrollment_mode" DEFAULT 'self_directed' NOT NULL,
	"status" "enrollment_status" DEFAULT 'pending_payment' NOT NULL,
	"attendance_records" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"promo_code_id" uuid,
	"stripe_checkout_session_id" text,
	"enrolled_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "enrollments_stripeCheckoutSessionId_unique" UNIQUE("stripe_checkout_session_id"),
	CONSTRAINT "enrollments_userId_courseId_unique" UNIQUE("user_id","course_id")
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"enrollment_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"course_id" uuid NOT NULL,
	"teacher_id" uuid NOT NULL,
	"stripe_checkout_session_id" text NOT NULL,
	"stripe_payment_intent_id" text,
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
	"status" "payment_status" DEFAULT 'succeeded' NOT NULL,
	"refunded_cents" integer DEFAULT 0 NOT NULL,
	"receipt_url" text,
	"paid_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payments_stripeCheckoutSessionId_unique" UNIQUE("stripe_checkout_session_id"),
	CONSTRAINT "payments_stripePaymentIntentId_unique" UNIQUE("stripe_payment_intent_id")
);
--> statement-breakpoint
CREATE TABLE "promo_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" "citext" NOT NULL,
	"type" "promo_type" NOT NULL,
	"value" integer NOT NULL,
	"course_id" uuid,
	"max_redemptions" integer,
	"redeemed_count" integer DEFAULT 0 NOT NULL,
	"starts_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"active" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "promo_codes_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "refunds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_id" uuid NOT NULL,
	"stripe_refund_id" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"reason" text,
	"requested_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "refunds_stripeRefundId_unique" UNIQUE("stripe_refund_id")
);
--> statement-breakpoint
CREATE TABLE "artefacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lesson_id" uuid NOT NULL,
	"type" "artefact_type" NOT NULL,
	"title" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"media_asset_id" uuid,
	"content_json" jsonb,
	"duration_seconds" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "courses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"teacher_id" uuid NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"summary" text,
	"description_json" jsonb,
	"category" text NOT NULL,
	"thumbnail_media_id" uuid,
	"price_cents" integer DEFAULT 0 NOT NULL,
	"currency" text DEFAULT 'sgd' NOT NULL,
	"status" "course_status" DEFAULT 'draft' NOT NULL,
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
	CONSTRAINT "courses_slug_unique" UNIQUE("slug"),
	CONSTRAINT "courses_price_cents_non_negative" CHECK ("courses"."price_cents" >= 0)
);
--> statement-breakpoint
CREATE TABLE "lesson_prerequisites" (
	"lesson_id" uuid NOT NULL,
	"prerequisite_lesson_id" uuid NOT NULL,
	CONSTRAINT "lesson_prerequisites_lesson_id_prerequisite_lesson_id_pk" PRIMARY KEY("lesson_id","prerequisite_lesson_id"),
	CONSTRAINT "lesson_prerequisites_not_self" CHECK ("lesson_prerequisites"."lesson_id" <> "lesson_prerequisites"."prerequisite_lesson_id")
);
--> statement-breakpoint
CREATE TABLE "lessons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"title" text NOT NULL,
	"summary" text,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quizzes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"artefact_id" uuid NOT NULL,
	"pass_mark_percent" integer DEFAULT 70 NOT NULL,
	"max_attempts" integer DEFAULT 1 NOT NULL,
	"time_limit_minutes" integer,
	"questions_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quizzes_artefactId_unique" UNIQUE("artefact_id")
);
--> statement-breakpoint
CREATE TABLE "artefact_progress" (
	"enrollment_id" uuid NOT NULL,
	"artefact_id" uuid NOT NULL,
	"status" "progress_status" DEFAULT 'not_started' NOT NULL,
	"position_seconds" integer DEFAULT 0 NOT NULL,
	"completed_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "artefact_progress_enrollment_id_artefact_id_pk" PRIMARY KEY("enrollment_id","artefact_id")
);
--> statement-breakpoint
CREATE TABLE "certificates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"enrollment_id" uuid NOT NULL,
	"token" text NOT NULL,
	"pdf_storage_key" text,
	"learner_name" text NOT NULL,
	"course_title" text NOT NULL,
	"teacher_name" text NOT NULL,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "certificates_enrollmentId_unique" UNIQUE("enrollment_id"),
	CONSTRAINT "certificates_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "quiz_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"enrollment_id" uuid NOT NULL,
	"quiz_id" uuid NOT NULL,
	"answers_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"score_percent" integer,
	"passed" boolean,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"submitted_at" timestamp with time zone,
	"expires_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "media_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"kind" "media_kind" NOT NULL,
	"provider" "media_provider" NOT NULL,
	"status" "media_status" DEFAULT 'pending' NOT NULL,
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
CREATE TABLE "analytics_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"name" text NOT NULL,
	"properties" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"provider" "webhook_provider" NOT NULL,
	"event_id" text NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"error" text,
	CONSTRAINT "webhook_events_provider_event_id_pk" PRIMARY KEY("provider","event_id")
);
--> statement-breakpoint
CREATE TABLE "teacher_profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"display_name" text NOT NULL,
	"headline" text,
	"bio" text,
	"credentials" text,
	"teaching_sample_url" text,
	"teaching_sample_media_id" uuid,
	"status" "teacher_status" DEFAULT 'applied' NOT NULL,
	"review_note" text,
	"commission_bps" integer DEFAULT 1500 NOT NULL,
	"stripe_account_id" text,
	"stripe_details_submitted" boolean DEFAULT false NOT NULL,
	"stripe_charges_enabled" boolean DEFAULT false NOT NULL,
	"stripe_payouts_enabled" boolean DEFAULT false NOT NULL,
	"applied_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_at" timestamp with time zone,
	"reviewed_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "teacher_profiles_stripeAccountId_unique" UNIQUE("stripe_account_id"),
	CONSTRAINT "teacher_profiles_commission_bps_range" CHECK ("teacher_profiles"."commission_bps" between 0 and 10000)
);
--> statement-breakpoint
ALTER TABLE "identities" ADD CONSTRAINT "identities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_granted_by_users_id_fk" FOREIGN KEY ("granted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_promo_code_id_promo_codes_id_fk" FOREIGN KEY ("promo_code_id") REFERENCES "public"."promo_codes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_enrollment_id_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_teacher_id_users_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_promo_code_id_promo_codes_id_fk" FOREIGN KEY ("promo_code_id") REFERENCES "public"."promo_codes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promo_codes" ADD CONSTRAINT "promo_codes_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promo_codes" ADD CONSTRAINT "promo_codes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artefacts" ADD CONSTRAINT "artefacts_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artefacts" ADD CONSTRAINT "artefacts_media_asset_id_media_assets_id_fk" FOREIGN KEY ("media_asset_id") REFERENCES "public"."media_assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "courses" ADD CONSTRAINT "courses_teacher_id_users_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "courses" ADD CONSTRAINT "courses_thumbnail_media_id_media_assets_id_fk" FOREIGN KEY ("thumbnail_media_id") REFERENCES "public"."media_assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "courses" ADD CONSTRAINT "courses_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_prerequisites" ADD CONSTRAINT "lesson_prerequisites_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_prerequisites" ADD CONSTRAINT "lesson_prerequisites_prerequisite_lesson_id_lessons_id_fk" FOREIGN KEY ("prerequisite_lesson_id") REFERENCES "public"."lessons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quizzes" ADD CONSTRAINT "quizzes_artefact_id_artefacts_id_fk" FOREIGN KEY ("artefact_id") REFERENCES "public"."artefacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artefact_progress" ADD CONSTRAINT "artefact_progress_enrollment_id_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artefact_progress" ADD CONSTRAINT "artefact_progress_artefact_id_artefacts_id_fk" FOREIGN KEY ("artefact_id") REFERENCES "public"."artefacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_enrollment_id_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_enrollment_id_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_quiz_id_quizzes_id_fk" FOREIGN KEY ("quiz_id") REFERENCES "public"."quizzes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_profiles" ADD CONSTRAINT "teacher_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_profiles" ADD CONSTRAINT "teacher_profiles_teaching_sample_media_id_media_assets_id_fk" FOREIGN KEY ("teaching_sample_media_id") REFERENCES "public"."media_assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_profiles" ADD CONSTRAINT "teacher_profiles_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "identities_user_id_index" ON "identities" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "magic_links_email_created_at_index" ON "magic_links" USING btree ("email","created_at");--> statement-breakpoint
CREATE INDEX "sessions_user_id_index" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_expires_at_index" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "enrollments_course_id_index" ON "enrollments" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "enrollments_user_id_status_index" ON "enrollments" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "payments_teacher_id_paid_at_index" ON "payments" USING btree ("teacher_id","paid_at");--> statement-breakpoint
CREATE INDEX "payments_course_id_index" ON "payments" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "payments_user_id_index" ON "payments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "artefacts_lesson_id_position_index" ON "artefacts" USING btree ("lesson_id","position");--> statement-breakpoint
CREATE INDEX "courses_teacher_id_index" ON "courses" USING btree ("teacher_id");--> statement-breakpoint
CREATE INDEX "courses_status_published_at_index" ON "courses" USING btree ("status","published_at");--> statement-breakpoint
CREATE INDEX "courses_status_enrol_count_index" ON "courses" USING btree ("status","enrol_count");--> statement-breakpoint
CREATE INDEX "lessons_course_id_position_index" ON "lessons" USING btree ("course_id","position");--> statement-breakpoint
CREATE INDEX "artefact_progress_enrollment_id_updated_at_index" ON "artefact_progress" USING btree ("enrollment_id","updated_at");--> statement-breakpoint
CREATE INDEX "quiz_attempts_enrollment_id_quiz_id_index" ON "quiz_attempts" USING btree ("enrollment_id","quiz_id");--> statement-breakpoint
CREATE INDEX "media_assets_owner_id_index" ON "media_assets" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "media_assets_provider_upload_id_index" ON "media_assets" USING btree ("provider_upload_id");--> statement-breakpoint
CREATE INDEX "media_assets_provider_asset_id_index" ON "media_assets" USING btree ("provider_asset_id");--> statement-breakpoint
CREATE INDEX "analytics_events_name_created_at_index" ON "analytics_events" USING btree ("name","created_at");--> statement-breakpoint
CREATE INDEX "audit_log_entity_type_entity_id_index" ON "audit_log" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "audit_log_created_at_index" ON "audit_log" USING btree ("created_at");