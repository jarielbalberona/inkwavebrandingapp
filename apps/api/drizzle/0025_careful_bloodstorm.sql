ALTER TABLE "lids" ADD COLUMN "min_stock" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "lids" ADD CONSTRAINT "lids_min_stock_non_negative" CHECK ("lids"."min_stock" >= 0);