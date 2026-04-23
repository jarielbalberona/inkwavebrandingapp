CREATE TYPE "public"."order_status" AS ENUM('pending', 'in_progress', 'partial_released', 'completed', 'canceled');--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"cup_id" uuid NOT NULL,
	"quantity" integer NOT NULL,
	"cost_price" numeric(12, 2) DEFAULT '0' NOT NULL,
	"sell_price" numeric(12, 2) DEFAULT '0' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "order_items_quantity_positive" CHECK ("order_items"."quantity" > 0),
	CONSTRAINT "order_items_cost_price_non_negative" CHECK ("order_items"."cost_price" >= 0),
	CONSTRAINT "order_items_sell_price_non_negative" CHECK ("order_items"."sell_price" >= 0)
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_number" varchar(80) NOT NULL,
	"customer_id" uuid NOT NULL,
	"status" "order_status" DEFAULT 'pending' NOT NULL,
	"notes" text,
	"created_by_user_id" uuid,
	"canceled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "orders_order_number_not_blank" CHECK (length(trim("orders"."order_number")) > 0)
);
--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_cup_id_cups_id_fk" FOREIGN KEY ("cup_id") REFERENCES "public"."cups"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "order_items_order_id_idx" ON "order_items" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "order_items_cup_id_idx" ON "order_items" USING btree ("cup_id");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_order_number_unique_idx" ON "orders" USING btree (lower("order_number"));--> statement-breakpoint
CREATE INDEX "orders_customer_id_idx" ON "orders" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "orders_status_idx" ON "orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "orders_created_at_idx" ON "orders" USING btree ("created_at");