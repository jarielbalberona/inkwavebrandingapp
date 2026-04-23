CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_code" varchar(80),
	"business_name" varchar(160) NOT NULL,
	"contact_person" varchar(160),
	"contact_number" varchar(40),
	"email" varchar(320),
	"address" varchar(500),
	"notes" varchar(500),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customers_business_name_not_blank" CHECK (length(trim("customers"."business_name")) > 0),
	CONSTRAINT "customers_customer_code_not_blank" CHECK ("customers"."customer_code" is null or length(trim("customers"."customer_code")) > 0),
	CONSTRAINT "customers_contact_person_not_blank" CHECK ("customers"."contact_person" is null or length(trim("customers"."contact_person")) > 0),
	CONSTRAINT "customers_contact_number_not_blank" CHECK ("customers"."contact_number" is null or length(trim("customers"."contact_number")) > 0),
	CONSTRAINT "customers_email_not_blank" CHECK ("customers"."email" is null or length(trim("customers"."email")) > 0),
	CONSTRAINT "customers_address_not_blank" CHECK ("customers"."address" is null or length(trim("customers"."address")) > 0),
	CONSTRAINT "customers_notes_not_blank" CHECK ("customers"."notes" is null or length(trim("customers"."notes")) > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "customers_customer_code_unique_idx" ON "customers" USING btree (lower("customer_code"));--> statement-breakpoint
CREATE INDEX "customers_business_name_idx" ON "customers" USING btree (lower("business_name"));--> statement-breakpoint
CREATE INDEX "customers_email_idx" ON "customers" USING btree (lower("email"));