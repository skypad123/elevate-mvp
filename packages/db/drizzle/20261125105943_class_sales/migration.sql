CREATE TYPE "elevate_cancel_reason" AS ENUM('teacher_absent', 'venue_unavailable', 'rules_breach', 'profile_suspended', 'required_by_law');--> statement-breakpoint
CREATE TYPE "payout_adjustment_kind" AS ENUM('opening_available', 'opening_pending', 'refund_after_payout', 'bank_dispute_after_payout', 'correction');--> statement-breakpoint
CREATE TYPE "payout_mode" AS ENUM('automatic', 'switching', 'manual');--> statement-breakpoint
CREATE TYPE "payout_outcome" AS ENUM('paid', 'below_minimum', 'nothing_payable', 'failed');--> statement-breakpoint
CREATE TYPE "seat_refund_kind" AS ENUM('teacher_cancelled', 'teacher_cancelled_part', 'changed_withdrew', 'learner_withdrew', 'discretionary', 'elevate_cancelled', 'seat_lost', 'dispute_lost');--> statement-breakpoint
CREATE TYPE "seat_refund_status" AS ENUM('waiting', 'pending', 'refund_sent', 'done', 'closed', 'failed');--> statement-breakpoint
ALTER TYPE "class_status" ADD VALUE 'cancelled';--> statement-breakpoint
CREATE TABLE "class_cancellations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"class_id" uuid NOT NULL UNIQUE,
	"cancelled_by" uuid,
	"by_elevate" boolean NOT NULL,
	"reason" text NOT NULL,
	"elevate_reason" "elevate_cancel_reason",
	"after_start" boolean NOT NULL,
	"blocks_total" integer NOT NULL,
	"blocks_untaught" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "payout_adjustments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"payout_account_id" uuid NOT NULL,
	"kind" "payout_adjustment_kind" NOT NULL,
	"amount_cents" integer NOT NULL,
	"payment_id" uuid,
	"refund_id" uuid,
	"reason" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"payout_id" uuid
);
--> statement-breakpoint
CREATE TABLE "payout_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"error" text,
	"refunds_sent" integer DEFAULT 0 NOT NULL,
	"classes_released" integer DEFAULT 0 NOT NULL,
	"payouts_created" integer DEFAULT 0 NOT NULL,
	"needing_attention" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"run_id" uuid NOT NULL,
	"payout_account_id" uuid NOT NULL,
	"pay_date" date NOT NULL,
	"available_cents" integer NOT NULL,
	"pending_cents" integer NOT NULL,
	"held_cents" integer NOT NULL,
	"limit_cents" integer NOT NULL,
	"named_cents" integer NOT NULL,
	"unnamed_cents" integer NOT NULL,
	"amount_cents" integer DEFAULT 0 NOT NULL,
	"outcome" "payout_outcome" NOT NULL,
	"send_status" text,
	"stripe_payout_id" text UNIQUE,
	"payout_status" text,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seat_refunds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"enrollment_id" uuid NOT NULL,
	"payment_id" uuid NOT NULL,
	"class_id" uuid NOT NULL,
	"kind" "seat_refund_kind" NOT NULL,
	"status" "seat_refund_status" DEFAULT 'pending'::"seat_refund_status" NOT NULL,
	"waiting_for" text,
	"closed_reason" text,
	"requested_cents" integer,
	"learner_refund_cents" integer,
	"fee_refund_to_profile_cents" integer,
	"stripe_refund_id" text UNIQUE,
	"stripe_fee_refund_id" text,
	"stripe_reversal_id" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"first_attempt_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"error" text,
	"reason" text,
	"cancellation_id" uuid,
	"requested_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP VIEW "self_paced_enrollments";--> statement-breakpoint
ALTER TABLE "classes" ADD COLUMN "cancelled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "classes" ADD COLUMN "cancelled_by" uuid;--> statement-breakpoint
ALTER TABLE "classes" ADD COLUMN "cancel_reason" text;--> statement-breakpoint
ALTER TABLE "classes" ADD COLUMN "released_run_id" uuid;--> statement-breakpoint
ALTER TABLE "classes" ADD COLUMN "released_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "classes" ADD COLUMN "release_reason" text;--> statement-breakpoint
ALTER TABLE "classes" ADD COLUMN "review_needed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "classes" ADD COLUMN "review_cleared_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "classes" ADD COLUMN "review_cleared_by" uuid;--> statement-breakpoint
ALTER TABLE "classes" ADD COLUMN "review_note" text;--> statement-breakpoint
ALTER TABLE "enrollments" ADD COLUMN "seat_reserved_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "enrollments" ADD COLUMN "reservation_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "enrollments" ADD COLUMN "reservation_count_since" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "enrollments" ADD COLUMN "refund_terms_version" text;--> statement-breakpoint
ALTER TABLE "enrollments" ADD COLUMN "moved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "enrollments" ADD COLUMN "moved_by" uuid;--> statement-breakpoint
ALTER TABLE "enrollments" ADD COLUMN "moved_from_class_id" uuid;--> statement-breakpoint
ALTER TABLE "enrollments" ADD COLUMN "class_changed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "class_id" uuid;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "released_run_id" uuid;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "released_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "release_reason" text;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "bank_dispute_id" text;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "bank_dispute_status" text;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "bank_disputed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "payout_id" uuid;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "paid_out_cents" integer;--> statement-breakpoint
ALTER TABLE "refunds" ADD COLUMN "application_fee_refunded_cents" integer;--> statement-breakpoint
ALTER TABLE "refunds" ADD COLUMN "seat_refund_id" uuid;--> statement-breakpoint
ALTER TABLE "payout_accounts" ADD COLUMN "payout_mode" "payout_mode" DEFAULT 'automatic'::"payout_mode" NOT NULL;--> statement-breakpoint
ALTER TABLE "payout_accounts" ADD COLUMN "manual_since" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "payout_accounts" ADD COLUMN "leave_requested_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "payout_accounts" ADD COLUMN "leave_on" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "class_sales_accepted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "class_sales_accepted_by" uuid;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "class_sales_terms_version" text;--> statement-breakpoint
CREATE INDEX "enrollments_class_id_status_index" ON "enrollments" ("class_id","status");--> statement-breakpoint
CREATE INDEX "payments_class_id_index" ON "payments" ("class_id");--> statement-breakpoint
CREATE INDEX "payments_payout_account_id_payout_id_index" ON "payments" ("payout_account_id","payout_id");--> statement-breakpoint
CREATE INDEX "payout_adjustments_payout_account_id_payout_id_index" ON "payout_adjustments" ("payout_account_id","payout_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payout_adjustments_one_per_refund" ON "payout_adjustments" ("refund_id") WHERE "refund_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "payout_adjustments_one_bank_dispute_per_payment" ON "payout_adjustments" ("payment_id") WHERE "kind" = 'bank_dispute_after_payout';--> statement-breakpoint
CREATE UNIQUE INDEX "payouts_payout_account_id_pay_date_index" ON "payouts" ("payout_account_id","pay_date");--> statement-breakpoint
CREATE INDEX "seat_refunds_status_index" ON "seat_refunds" ("status");--> statement-breakpoint
CREATE INDEX "seat_refunds_payment_id_index" ON "seat_refunds" ("payment_id");--> statement-breakpoint
CREATE INDEX "seat_refunds_cancellation_id_index" ON "seat_refunds" ("cancellation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "seat_refunds_one_unfinished_per_enrollment" ON "seat_refunds" ("enrollment_id") WHERE "status" in ('waiting', 'pending', 'refund_sent', 'failed');--> statement-breakpoint
CREATE UNIQUE INDEX "seat_refunds_one_dispute_lost_per_payment" ON "seat_refunds" ("payment_id") WHERE "kind" = 'dispute_lost';--> statement-breakpoint
ALTER TABLE "classes" ADD CONSTRAINT "classes_cancelled_by_users_id_fkey" FOREIGN KEY ("cancelled_by") REFERENCES "users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "classes" ADD CONSTRAINT "classes_released_run_id_payout_runs_id_fkey" FOREIGN KEY ("released_run_id") REFERENCES "payout_runs"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "classes" ADD CONSTRAINT "classes_review_cleared_by_users_id_fkey" FOREIGN KEY ("review_cleared_by") REFERENCES "users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_moved_by_users_id_fkey" FOREIGN KEY ("moved_by") REFERENCES "users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_moved_from_class_id_classes_id_fkey" FOREIGN KEY ("moved_from_class_id") REFERENCES "classes"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_class_id_classes_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_released_run_id_payout_runs_id_fkey" FOREIGN KEY ("released_run_id") REFERENCES "payout_runs"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_payout_id_payouts_id_fkey" FOREIGN KEY ("payout_id") REFERENCES "payouts"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_seat_refund_id_seat_refunds_id_fkey" FOREIGN KEY ("seat_refund_id") REFERENCES "seat_refunds"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "class_cancellations" ADD CONSTRAINT "class_cancellations_class_id_classes_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "class_cancellations" ADD CONSTRAINT "class_cancellations_cancelled_by_users_id_fkey" FOREIGN KEY ("cancelled_by") REFERENCES "users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "payout_adjustments" ADD CONSTRAINT "payout_adjustments_payout_account_id_payout_accounts_id_fkey" FOREIGN KEY ("payout_account_id") REFERENCES "payout_accounts"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "payout_adjustments" ADD CONSTRAINT "payout_adjustments_payment_id_payments_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "payout_adjustments" ADD CONSTRAINT "payout_adjustments_refund_id_refunds_id_fkey" FOREIGN KEY ("refund_id") REFERENCES "refunds"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "payout_adjustments" ADD CONSTRAINT "payout_adjustments_created_by_users_id_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "payout_adjustments" ADD CONSTRAINT "payout_adjustments_payout_id_payouts_id_fkey" FOREIGN KEY ("payout_id") REFERENCES "payouts"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_run_id_payout_runs_id_fkey" FOREIGN KEY ("run_id") REFERENCES "payout_runs"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_payout_account_id_payout_accounts_id_fkey" FOREIGN KEY ("payout_account_id") REFERENCES "payout_accounts"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "seat_refunds" ADD CONSTRAINT "seat_refunds_enrollment_id_enrollments_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "enrollments"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "seat_refunds" ADD CONSTRAINT "seat_refunds_payment_id_payments_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "seat_refunds" ADD CONSTRAINT "seat_refunds_class_id_classes_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "seat_refunds" ADD CONSTRAINT "seat_refunds_cancellation_id_class_cancellations_id_fkey" FOREIGN KEY ("cancellation_id") REFERENCES "class_cancellations"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "seat_refunds" ADD CONSTRAINT "seat_refunds_requested_by_users_id_fkey" FOREIGN KEY ("requested_by") REFERENCES "users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_class_sales_accepted_by_users_id_fkey" FOREIGN KEY ("class_sales_accepted_by") REFERENCES "users"("id") ON DELETE SET NULL;--> statement-breakpoint
CREATE VIEW "self_paced_enrollments" AS (select "id", "user_id", "course_id", "mode", "status", "attendance_records", "promo_code_id", "stripe_checkout_session_id", "class_id", "seat_reserved_until", "reservation_count", "reservation_count_since", "refund_terms_version", "moved_at", "moved_by", "moved_from_class_id", "class_changed_at", "enrolled_at", "completed_at", "created_at", "updated_at" from "enrollments" where ("enrollments"."class_id" is null));