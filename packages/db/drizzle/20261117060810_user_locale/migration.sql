CREATE TYPE "locale" AS ENUM('en', 'zh');--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "locale" "locale";--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "locale_chosen" boolean DEFAULT false NOT NULL;