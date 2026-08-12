ALTER TYPE "public"."inventory_item_type" ADD VALUE IF NOT EXISTS 'paper_bowl';--> statement-breakpoint
ALTER TABLE "inventory_movements" DROP CONSTRAINT "inventory_movements_exactly_one_item";--> statement-breakpoint
ALTER TABLE "inventory_movements" DROP CONSTRAINT "inventory_movements_item_type_matches_reference";--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD COLUMN "paper_bowl_id" uuid;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_paper_bowl_id_paper_bowls_id_fk" FOREIGN KEY ("paper_bowl_id") REFERENCES "public"."paper_bowls"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_exactly_one_item" CHECK ((
        ("inventory_movements"."cup_id" IS NOT NULL AND "inventory_movements"."lid_id" IS NULL AND "inventory_movements"."paper_bowl_id" IS NULL)
        OR
        ("inventory_movements"."cup_id" IS NULL AND "inventory_movements"."lid_id" IS NOT NULL AND "inventory_movements"."paper_bowl_id" IS NULL)
        OR
        ("inventory_movements"."cup_id" IS NULL AND "inventory_movements"."lid_id" IS NULL AND "inventory_movements"."paper_bowl_id" IS NOT NULL)
      ));--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_item_type_matches_reference" CHECK ((
        ("inventory_movements"."item_type" = 'cup' AND "inventory_movements"."cup_id" IS NOT NULL AND "inventory_movements"."lid_id" IS NULL AND "inventory_movements"."paper_bowl_id" IS NULL)
        OR
        ("inventory_movements"."item_type" = 'lid' AND "inventory_movements"."lid_id" IS NOT NULL AND "inventory_movements"."cup_id" IS NULL AND "inventory_movements"."paper_bowl_id" IS NULL)
        OR
        ("inventory_movements"."item_type" = 'paper_bowl' AND "inventory_movements"."paper_bowl_id" IS NOT NULL AND "inventory_movements"."cup_id" IS NULL AND "inventory_movements"."lid_id" IS NULL)
      ));
