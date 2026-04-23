CREATE TYPE "public"."inventory_item_type" AS ENUM('cup', 'lid');--> statement-breakpoint
ALTER TABLE "inventory_movements" ALTER COLUMN "cup_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD COLUMN "item_type" "inventory_item_type";--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD COLUMN "lid_id" uuid;--> statement-breakpoint
UPDATE "inventory_movements"
SET "item_type" = 'cup'
WHERE "cup_id" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "inventory_movements" ALTER COLUMN "item_type" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_lid_id_lids_id_fk" FOREIGN KEY ("lid_id") REFERENCES "public"."lids"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_exactly_one_item" CHECK ((
        ("inventory_movements"."cup_id" IS NOT NULL AND "inventory_movements"."lid_id" IS NULL)
        OR
        ("inventory_movements"."cup_id" IS NULL AND "inventory_movements"."lid_id" IS NOT NULL)
      ));--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_item_type_matches_reference" CHECK ((
        ("inventory_movements"."item_type" = 'cup' AND "inventory_movements"."cup_id" IS NOT NULL AND "inventory_movements"."lid_id" IS NULL)
        OR
        ("inventory_movements"."item_type" = 'lid' AND "inventory_movements"."lid_id" IS NOT NULL AND "inventory_movements"."cup_id" IS NULL)
      ));
