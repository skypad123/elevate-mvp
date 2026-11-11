DROP INDEX "enrollments_course_id_index";--> statement-breakpoint
CREATE INDEX "enrollments_course_id_status_index" ON "enrollments" USING btree ("course_id","status");--> statement-breakpoint
CREATE INDEX "payments_paid_at_index" ON "payments" USING btree ("paid_at");--> statement-breakpoint
CREATE INDEX "payments_status_paid_at_index" ON "payments" USING btree ("status","paid_at");