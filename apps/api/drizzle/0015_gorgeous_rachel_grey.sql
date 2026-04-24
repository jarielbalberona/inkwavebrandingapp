ALTER TABLE "orders" ADD COLUMN "priority" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
WITH ranked_orders AS (
  SELECT
    "id",
    row_number() OVER (ORDER BY "created_at" DESC, "id" ASC) - 1 AS "next_priority"
  FROM "orders"
)
UPDATE "orders"
SET "priority" = ranked_orders."next_priority"
FROM ranked_orders
WHERE ranked_orders."id" = "orders"."id";--> statement-breakpoint
CREATE INDEX "orders_priority_idx" ON "orders" USING btree ("priority");--> statement-breakpoint
