CREATE TABLE "invoice_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" uuid NOT NULL,
	"order_item_id" uuid NOT NULL,
	"item_type" "order_line_item_type" NOT NULL,
	"description_snapshot" text NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price" numeric(12, 2) DEFAULT '0' NOT NULL,
	"line_total" numeric(12, 2) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invoice_items_quantity_positive" CHECK ("invoice_items"."quantity" > 0),
	CONSTRAINT "invoice_items_description_snapshot_not_blank" CHECK (length(trim("invoice_items"."description_snapshot")) > 0),
	CONSTRAINT "invoice_items_unit_price_non_negative" CHECK ("invoice_items"."unit_price" >= 0),
	CONSTRAINT "invoice_items_line_total_non_negative" CHECK ("invoice_items"."line_total" >= 0)
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_number" varchar(80) NOT NULL,
	"order_id" uuid NOT NULL,
	"order_number_snapshot" varchar(80) NOT NULL,
	"customer_id" uuid NOT NULL,
	"customer_code_snapshot" varchar(80),
	"customer_business_name_snapshot" varchar(160) NOT NULL,
	"customer_contact_person_snapshot" varchar(160),
	"customer_contact_number_snapshot" varchar(40),
	"customer_email_snapshot" varchar(320),
	"customer_address_snapshot" varchar(500),
	"subtotal" numeric(12, 2) DEFAULT '0' NOT NULL,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invoices_invoice_number_not_blank" CHECK (length(trim("invoices"."invoice_number")) > 0),
	CONSTRAINT "invoices_order_number_snapshot_not_blank" CHECK (length(trim("invoices"."order_number_snapshot")) > 0),
	CONSTRAINT "invoices_customer_business_name_not_blank" CHECK (length(trim("invoices"."customer_business_name_snapshot")) > 0),
	CONSTRAINT "invoices_subtotal_non_negative" CHECK ("invoices"."subtotal" >= 0)
);
--> statement-breakpoint
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_order_item_id_order_items_id_fk" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "invoice_items_invoice_id_idx" ON "invoice_items" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "invoice_items_order_item_id_idx" ON "invoice_items" USING btree ("order_item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_invoice_number_unique_idx" ON "invoices" USING btree (lower("invoice_number"));--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_order_id_unique_idx" ON "invoices" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "invoices_customer_id_idx" ON "invoices" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "invoices_created_at_idx" ON "invoices" USING btree ("created_at");