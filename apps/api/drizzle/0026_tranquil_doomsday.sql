ALTER TABLE "lids" DROP CONSTRAINT "lids_type_color_contract";--> statement-breakpoint
ALTER TABLE "lids" ADD CONSTRAINT "lids_type_color_contract" CHECK ((
        ("lids"."type" = 'paper' AND "lids"."color" IN ('black', 'white'))
        OR
        (
          "lids"."type" = 'plastic'
          AND "lids"."brand" IN ('dabba', 'grecoopack')
          AND "lids"."color" = 'transparent'
        )
        OR
        (
          "lids"."type" = 'plastic'
          AND "lids"."brand" IN ('china_supplier', 'other_supplier')
          AND "lids"."color" IN ('transparent', 'black')
        )
      ));