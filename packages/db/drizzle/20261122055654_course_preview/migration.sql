ALTER TABLE "courses" ADD COLUMN "preview_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "preview_media_id" uuid;--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "preview_start_seconds" integer;--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "preview_key" text;--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "preview_source_media_id" uuid;--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "preview_source_start_seconds" integer;--> statement-breakpoint
ALTER TABLE "media_assets" ADD COLUMN "preview_fetches" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "courses" ADD CONSTRAINT "courses_preview_media_id_media_assets_id_fkey" FOREIGN KEY ("preview_media_id") REFERENCES "media_assets"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "courses" ADD CONSTRAINT "courses_preview_source_media_id_media_assets_id_fkey" FOREIGN KEY ("preview_source_media_id") REFERENCES "media_assets"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "courses" ADD CONSTRAINT "courses_preview_start_seconds_non_negative" CHECK ("preview_start_seconds" is null or "preview_start_seconds" >= 0);