CREATE TABLE "invoice_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" uuid NOT NULL,
	"amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"payment_date" timestamp with time zone NOT NULL,
	"note" text,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invoice_payments_amount_positive" CHECK ("invoice_payments"."amount" > 0),
	CONSTRAINT "invoice_payments_note_not_blank" CHECK ("invoice_payments"."note" is null or length(trim("invoice_payments"."note")) > 0)
);
--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "total_amount" numeric(12, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "paid_amount" numeric(12, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "remaining_balance" numeric(12, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "due_date" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "notes" text;--> statement-breakpoint
UPDATE "invoices"
SET
	"total_amount" = "subtotal",
	"paid_amount" = CASE
		WHEN "status" = 'paid' THEN "subtotal"
		ELSE 0
	END,
	"remaining_balance" = CASE
		WHEN "status" = 'paid' THEN 0
		ELSE "subtotal"
	END;--> statement-breakpoint
ALTER TABLE "invoice_payments" ADD CONSTRAINT "invoice_payments_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_payments" ADD CONSTRAINT "invoice_payments_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "invoice_payments_invoice_id_idx" ON "invoice_payments" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "invoice_payments_payment_date_idx" ON "invoice_payments" USING btree ("payment_date");--> statement-breakpoint
CREATE INDEX "invoice_payments_created_by_user_id_idx" ON "invoice_payments" USING btree ("created_by_user_id");--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_total_amount_non_negative" CHECK ("invoices"."total_amount" >= 0);--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_paid_amount_non_negative" CHECK ("invoices"."paid_amount" >= 0);--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_remaining_balance_non_negative" CHECK ("invoices"."remaining_balance" >= 0);--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_paid_amount_not_greater_than_total" CHECK ("invoices"."paid_amount" <= "invoices"."total_amount");--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_remaining_balance_matches_totals" CHECK ("invoices"."remaining_balance" = "invoices"."total_amount" - "invoices"."paid_amount");--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_notes_not_blank" CHECK ("invoices"."notes" is null or length(trim("invoices"."notes")) > 0);
