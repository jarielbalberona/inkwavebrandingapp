CREATE TYPE "public"."asset_kind" AS ENUM('invoice_pdf');--> statement-breakpoint
CREATE TYPE "public"."asset_storage_provider" AS ENUM('r2');--> statement-breakpoint
CREATE TYPE "public"."asset_visibility" AS ENUM('public', 'private');--> statement-breakpoint
CREATE TABLE "assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "asset_kind" NOT NULL,
	"storage_provider" "asset_storage_provider" NOT NULL,
	"visibility" "asset_visibility" NOT NULL,
	"object_key" varchar(512) NOT NULL,
	"public_url" varchar(1024),
	"filename" varchar(255) NOT NULL,
	"content_type" varchar(255) NOT NULL,
	"size_bytes" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "assets_object_key_not_blank" CHECK (length(trim("assets"."object_key")) > 0),
	CONSTRAINT "assets_filename_not_blank" CHECK (length(trim("assets"."filename")) > 0),
	CONSTRAINT "assets_content_type_not_blank" CHECK (length(trim("assets"."content_type")) > 0),
	CONSTRAINT "assets_size_bytes_positive" CHECK ("assets"."size_bytes" > 0)
);
--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "document_asset_id" uuid;--> statement-breakpoint
CREATE UNIQUE INDEX "assets_object_key_unique_idx" ON "assets" USING btree ("object_key");--> statement-breakpoint
CREATE INDEX "assets_kind_idx" ON "assets" USING btree ("kind");--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_document_asset_id_assets_id_fk" FOREIGN KEY ("document_asset_id") REFERENCES "public"."assets"("id") ON DELETE set null ON UPDATE no action;