CREATE TYPE "attendance_event_type" AS ENUM('attempt_refused', 'check_in', 'overturn', 'manual_mark', 'dispute', 'dispute_decision');--> statement-breakpoint
CREATE TYPE "class_delivery" AS ENUM('in_person', 'remote');--> statement-breakpoint
CREATE TYPE "class_status" AS ENUM('draft', 'published');--> statement-breakpoint
CREATE TABLE "attendance_event_locations" (
	"event_id" uuid PRIMARY KEY,
	"lat" double precision NOT NULL,
	"lng" double precision NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attendance_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"class_id" uuid NOT NULL,
	"block_id" uuid NOT NULL,
	"enrollment_id" uuid NOT NULL,
	"learner_user_id" uuid NOT NULL,
	"type" "attendance_event_type" NOT NULL,
	"actor_user_id" uuid NOT NULL,
	"actor_role" text NOT NULL,
	"method" text,
	"refusal_reason" text,
	"location_status" text,
	"accuracy_m" double precision,
	"distance_m" double precision,
	"venue_lat" double precision,
	"venue_lng" double precision,
	"venue_accuracy_m" double precision,
	"venue_radius_m" integer,
	"code_period" bigint,
	"client_time" timestamp with time zone,
	"platform" text,
	"app_version" text,
	"reason_code" text,
	"reason" text,
	"id_document_type" text,
	"decision" text,
	"refers_to_event_id" uuid,
	"request_id" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "class_blocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"class_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"code_secret" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "class_blocks_ends_after_starts" CHECK ("ends_at" > "starts_at")
);
--> statement-breakpoint
CREATE TABLE "classes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"profile_id" uuid NOT NULL,
	"course_id" uuid NOT NULL,
	"name" text NOT NULL,
	"delivery" "class_delivery" NOT NULL,
	"venue_address" text,
	"venue_lat" double precision,
	"venue_lng" double precision,
	"venue_accuracy_m" double precision,
	"venue_set_at" timestamp with time zone,
	"venue_set_by" uuid,
	"venue_radius_m" integer DEFAULT 200 NOT NULL,
	"instructor_user_id" uuid NOT NULL,
	"seats" integer NOT NULL,
	"time_zone" text DEFAULT 'Asia/Singapore' NOT NULL,
	"status" "class_status" DEFAULT 'draft'::"class_status" NOT NULL,
	"published_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "enrollments" DROP CONSTRAINT "enrollments_user_id_course_id_unique";--> statement-breakpoint
ALTER TABLE "enrollments" ADD COLUMN "class_id" uuid;--> statement-breakpoint
CREATE INDEX "attendance_events_block_id_enrollment_id_created_at_index" ON "attendance_events" ("block_id","enrollment_id","created_at");--> statement-breakpoint
CREATE INDEX "attendance_events_class_id_created_at_index" ON "attendance_events" ("class_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "attendance_events_one_check_in" ON "attendance_events" ("block_id","enrollment_id") WHERE "type" = 'check_in';--> statement-breakpoint
CREATE UNIQUE INDEX "attendance_events_one_per_referred_event" ON "attendance_events" ("refers_to_event_id","type") WHERE "refers_to_event_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "class_blocks_class_id_position_index" ON "class_blocks" ("class_id","position");--> statement-breakpoint
CREATE INDEX "classes_profile_id_status_index" ON "classes" ("profile_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "enrollments_one_self_paced_per_course" ON "enrollments" ("user_id","course_id") WHERE "class_id" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "enrollments_one_per_class" ON "enrollments" ("user_id","class_id") WHERE "class_id" is not null;--> statement-breakpoint
CREATE INDEX "enrollments_class_id_index" ON "enrollments" ("class_id");--> statement-breakpoint
ALTER TABLE "attendance_event_locations" ADD CONSTRAINT "attendance_event_locations_event_id_attendance_events_id_fkey" FOREIGN KEY ("event_id") REFERENCES "attendance_events"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "attendance_events" ADD CONSTRAINT "attendance_events_class_id_classes_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "attendance_events" ADD CONSTRAINT "attendance_events_block_id_class_blocks_id_fkey" FOREIGN KEY ("block_id") REFERENCES "class_blocks"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "attendance_events" ADD CONSTRAINT "attendance_events_enrollment_id_enrollments_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "enrollments"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "attendance_events" ADD CONSTRAINT "attendance_events_learner_user_id_users_id_fkey" FOREIGN KEY ("learner_user_id") REFERENCES "users"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "attendance_events" ADD CONSTRAINT "attendance_events_actor_user_id_users_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "attendance_events" ADD CONSTRAINT "attendance_events_refers_to_event_id_attendance_events_id_fkey" FOREIGN KEY ("refers_to_event_id") REFERENCES "attendance_events"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "class_blocks" ADD CONSTRAINT "class_blocks_class_id_classes_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "classes" ADD CONSTRAINT "classes_profile_id_profiles_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "classes" ADD CONSTRAINT "classes_course_id_courses_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "classes" ADD CONSTRAINT "classes_venue_set_by_users_id_fkey" FOREIGN KEY ("venue_set_by") REFERENCES "users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "classes" ADD CONSTRAINT "classes_instructor_user_id_users_id_fkey" FOREIGN KEY ("instructor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "classes" ADD CONSTRAINT "classes_created_by_users_id_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_class_id_classes_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE RESTRICT;--> statement-breakpoint
CREATE VIEW "self_paced_enrollments" AS (select "id", "user_id", "course_id", "mode", "status", "attendance_records", "promo_code_id", "stripe_checkout_session_id", "class_id", "enrolled_at", "completed_at", "created_at", "updated_at" from "enrollments" where ("enrollments"."class_id" is null));