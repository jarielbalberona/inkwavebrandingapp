-- Reconcile five fulfilled legacy orders whose aggregate bundle progress was
-- recorded against sibling lines sharing the same physical cup/lid SKU.
-- Quantities are redistributed without changing historical stock deductions,
-- then outstanding fulfilled reservations are consumed: 1,999 cups and 2,000
-- lids for Tuesday, plus 500 dome lids each for Meltin Pot and Mökki.

-- Mökki: split the 1,000 recorded 16oz cup units across the two 480-unit lines
-- and retain the genuine 40-unit production overrun.
UPDATE "order_line_item_progress_events"
SET "quantity" = 480
WHERE "id" IN (
  'd7e72626-ea5c-47da-ab95-49d82a3dc1da',
  'b1ea8f70-3a15-48a2-a39b-658ca8e78d87',
  '588ddd11-af0d-4dd7-85cf-8b9e1890418e',
  'fb3e9a2d-321c-4c29-acea-72802272bd37'
);--> statement-breakpoint
UPDATE "inventory_movements"
SET "quantity" = 480
WHERE "id" = '3802ab91-90f2-46b3-81e3-a374de2504c4';--> statement-breakpoint

INSERT INTO "order_line_item_progress_events" (
  "id", "order_line_item_id", "stage", "component_item_type", "quantity",
  "release_method", "released_to", "note", "event_date", "created_by_user_id"
)
SELECT v.id::uuid, v.order_item_id::uuid, v.stage::order_line_item_progress_stage,
       'cup', 480, v.release_method, v.released_to,
       'Administrative reconciliation of fulfilled sibling bundle quantities',
       '2026-06-30T00:00:00Z'::timestamptz,
       '63f50fed-3f2e-464d-82d0-b0e8dcea4812'::uuid
FROM (VALUES
  ('df51c8b5-44c9-4d62-9658-8e45c8af5fa7', '5155d316-35df-43f5-91b6-0a1f4c1bbb76', 'printed', NULL::varchar, NULL::text),
  ('71b5dfae-6f39-40f5-aa11-c2ae4318cefd', '5155d316-35df-43f5-91b6-0a1f4c1bbb76', 'qa_passed', NULL::varchar, NULL::text),
  ('e8525c8a-f4ec-41c9-8175-4dcc0aed1355', '5155d316-35df-43f5-91b6-0a1f4c1bbb76', 'packed', NULL::varchar, NULL::text),
  ('d2f56fc1-bb73-4183-89ad-c78490b9d9c1', '5155d316-35df-43f5-91b6-0a1f4c1bbb76', 'ready_for_release', NULL::varchar, NULL::text),
  ('2b85b5dc-b8f7-46cb-9a4a-8cec636a7878', '5155d316-35df-43f5-91b6-0a1f4c1bbb76', 'released', 'delivery', NULL::text)
) AS v(id, order_item_id, stage, release_method, released_to)
JOIN "order_items" oi ON oi."id" = v.order_item_id::uuid
ON CONFLICT ("id") DO NOTHING;--> statement-breakpoint

INSERT INTO "inventory_movements" (
  "id", "item_type", "cup_id", "movement_type", "quantity", "order_id",
  "order_item_id", "note", "reference", "created_by_user_id"
)
SELECT 'ccc26548-c6c3-45fc-a558-b3b7ee1de8f3'::uuid, 'cup', pb."cup_id",
       'consume', 480, oi."order_id", oi."id",
       'Reassigned fulfilled cup consumption from sibling bundle line',
       'df51c8b5-44c9-4d62-9658-8e45c8af5fa7',
       '63f50fed-3f2e-464d-82d0-b0e8dcea4812'::uuid
FROM "order_items" oi
JOIN "product_bundles" pb ON pb."id" = oi."product_bundle_id"
WHERE oi."id" = '5155d316-35df-43f5-91b6-0a1f4c1bbb76'
ON CONFLICT ("id") DO NOTHING;--> statement-breakpoint
INSERT INTO "inventory_movements" (
  "id", "item_type", "cup_id", "movement_type", "quantity", "order_id",
  "order_item_id", "note", "reference", "created_by_user_id"
)
SELECT '37ea9d06-ea6c-4e6a-a227-f8cf3ae82cab'::uuid, 'cup', pb."cup_id",
       'adjustment_out', 40, oi."order_id", oi."id",
       'Preserved genuine cup production overrun during fulfillment reconciliation',
       'd7e72626-ea5c-47da-ab95-49d82a3dc1da',
       '63f50fed-3f2e-464d-82d0-b0e8dcea4812'::uuid
FROM "order_items" oi
JOIN "product_bundles" pb ON pb."id" = oi."product_bundle_id"
WHERE oi."id" = '38ada89a-4f39-468d-a8f0-556f00d75c7f'
ON CONFLICT ("id") DO NOTHING;--> statement-breakpoint

-- Celest: redistribute the aggregate 1,000 cup stages into 300 dome + 700 flat.
UPDATE "order_line_item_progress_events"
SET "quantity" = 300
WHERE "id" IN (
  '8195ed10-ccd8-48ee-b5d0-998d172fde5d',
  '4595c8df-1ff9-4db1-af79-904fde69b37f',
  'bded44af-f8f9-497c-87b3-35017b8bf04a',
  'df19bcc4-0dc1-45b2-907c-5fb36a2ed9c5',
  '76d45a4c-0393-4796-ae5e-f28ebb71d42e'
);--> statement-breakpoint
UPDATE "inventory_movements"
SET "quantity" = 300
WHERE "id" = '2ba95fc1-22fd-4374-ad0c-0e16097108f0';--> statement-breakpoint

INSERT INTO "order_line_item_progress_events" (
  "id", "order_line_item_id", "stage", "component_item_type", "quantity",
  "release_method", "released_to", "note", "event_date", "created_by_user_id"
)
SELECT v.id::uuid, v.order_item_id::uuid, v.stage::order_line_item_progress_stage,
       'cup', 700, v.release_method, v.released_to,
       'Administrative reconciliation of fulfilled sibling bundle quantities',
       '2026-06-23T00:00:00Z'::timestamptz,
       '63f50fed-3f2e-464d-82d0-b0e8dcea4812'::uuid
FROM (VALUES
  ('f8dde09f-9c6f-41dd-a13f-817dffaff339', '5227be69-ca1f-48dd-a027-7a81fe30f12b', 'printed', NULL::varchar, NULL::text),
  ('3b6e7772-1575-421e-bb42-a6ec9573ed50', '5227be69-ca1f-48dd-a027-7a81fe30f12b', 'qa_passed', NULL::varchar, NULL::text),
  ('8bc073c5-20a9-451b-9d54-66e2452baa43', '5227be69-ca1f-48dd-a027-7a81fe30f12b', 'packed', NULL::varchar, NULL::text),
  ('7cffc495-d822-4b00-978a-e3d169c90c98', '5227be69-ca1f-48dd-a027-7a81fe30f12b', 'ready_for_release', NULL::varchar, NULL::text),
  ('b0034ab2-83ee-4205-a835-2e82deb7127a', '5227be69-ca1f-48dd-a027-7a81fe30f12b', 'released', 'delivery', 'Celest Coffee')
) AS v(id, order_item_id, stage, release_method, released_to)
JOIN "order_items" oi ON oi."id" = v.order_item_id::uuid
ON CONFLICT ("id") DO NOTHING;--> statement-breakpoint

INSERT INTO "inventory_movements" (
  "id", "item_type", "cup_id", "movement_type", "quantity", "order_id",
  "order_item_id", "note", "reference", "created_by_user_id"
)
SELECT 'e6094ed4-ee24-4df2-8b10-0635d79cdcbf'::uuid, 'cup', pb."cup_id",
       'consume', 700, oi."order_id", oi."id",
       'Reassigned fulfilled cup consumption from sibling bundle line',
       'f8dde09f-9c6f-41dd-a13f-817dffaff339',
       '63f50fed-3f2e-464d-82d0-b0e8dcea4812'::uuid
FROM "order_items" oi
JOIN "product_bundles" pb ON pb."id" = oi."product_bundle_id"
WHERE oi."id" = '5227be69-ca1f-48dd-a027-7a81fe30f12b'
ON CONFLICT ("id") DO NOTHING;--> statement-breakpoint

-- Tuesday: normalize the 8,000 aggregate stages to the 5,000-unit white line,
-- then complete the 5,000-unit dark line and consume the remaining reservations.
UPDATE "order_line_item_progress_events" SET "quantity" = 4999
WHERE "id" = 'e5645a18-8b12-46d4-844e-6da769270de7';--> statement-breakpoint
UPDATE "order_line_item_progress_events" SET "quantity" = 5000
WHERE "id" IN (
  'db708f4f-65e0-41a5-bafb-e85c2cea7430',
  'e9b994cf-c1ff-4bae-9f29-0d365f017243',
  '7a609131-daa5-4111-85be-7e74f3fe5c9e',
  'dbfb742d-31a0-461f-bdf2-d34d881af8f9'
);--> statement-breakpoint
UPDATE "inventory_movements" SET "quantity" = 4999
WHERE "id" = '9d235100-7ed9-44b2-a016-237e06db8b53';--> statement-breakpoint

INSERT INTO "order_line_item_progress_events" (
  "id", "order_line_item_id", "stage", "component_item_type", "quantity",
  "release_method", "released_to", "note", "event_date", "created_by_user_id"
)
SELECT v.id::uuid, v.order_item_id::uuid, v.stage::order_line_item_progress_stage,
       v.component_item_type, v.quantity, v.release_method, v.released_to,
       'Administrative reconciliation confirmed fulfilled order',
       '2026-06-22T00:00:00Z'::timestamptz,
       '63f50fed-3f2e-464d-82d0-b0e8dcea4812'::uuid
FROM (VALUES
  ('5f79fe55-bf1e-4f3a-8e6e-60a05f4bdad6', '8468bfb9-1e44-44fd-bcd1-42f47564efdc', 'printed', 'cup', 5000, NULL::varchar, NULL::text),
  ('6a9f1a21-112d-48ef-8f54-65f8d57bc592', '8468bfb9-1e44-44fd-bcd1-42f47564efdc', 'qa_passed', 'cup', 5000, NULL::varchar, NULL::text),
  ('a751cb9e-68b5-4ab9-96a1-c8356b2c8648', '8468bfb9-1e44-44fd-bcd1-42f47564efdc', 'packed', 'cup', 5000, NULL::varchar, NULL::text),
  ('28c0dcdb-75a0-4994-8196-27248cfff6af', '8468bfb9-1e44-44fd-bcd1-42f47564efdc', 'ready_for_release', 'cup', 5000, NULL::varchar, NULL::text),
  ('87686959-d4fe-43be-8190-57491db7e7e2', '8468bfb9-1e44-44fd-bcd1-42f47564efdc', 'released', 'cup', 5000, 'delivery', 'Tuesday'),
  ('596ea84f-16b9-4c8e-98d1-d3620c78323e', '8468bfb9-1e44-44fd-bcd1-42f47564efdc', 'packed', 'lid', 2000, NULL::varchar, NULL::text),
  ('e1cfd4ca-08a8-4fde-8bc1-c95c4820ac21', '8468bfb9-1e44-44fd-bcd1-42f47564efdc', 'ready_for_release', 'lid', 2000, NULL::varchar, NULL::text),
  ('74ac89d6-0f6a-4813-8194-40a68301ea05', '8468bfb9-1e44-44fd-bcd1-42f47564efdc', 'released', 'lid', 2000, 'delivery', 'Tuesday')
) AS v(id, order_item_id, stage, component_item_type, quantity, release_method, released_to)
JOIN "order_items" oi ON oi."id" = v.order_item_id::uuid
ON CONFLICT ("id") DO NOTHING;--> statement-breakpoint

INSERT INTO "inventory_movements" (
  "id", "item_type", "cup_id", "movement_type", "quantity", "order_id",
  "order_item_id", "note", "reference", "created_by_user_id"
)
SELECT 'f400efa7-aceb-4c14-9b18-cab60ffddcf1'::uuid, 'cup', pb."cup_id",
       'consume', 5000, oi."order_id", oi."id",
       'Consumed remaining fulfilled cup reservation during reconciliation',
       '5f79fe55-bf1e-4f3a-8e6e-60a05f4bdad6',
       '63f50fed-3f2e-464d-82d0-b0e8dcea4812'::uuid
FROM "order_items" oi
JOIN "product_bundles" pb ON pb."id" = oi."product_bundle_id"
WHERE oi."id" = '8468bfb9-1e44-44fd-bcd1-42f47564efdc'
ON CONFLICT ("id") DO NOTHING;--> statement-breakpoint
INSERT INTO "inventory_movements" (
  "id", "item_type", "lid_id", "movement_type", "quantity", "order_id",
  "order_item_id", "note", "reference", "created_by_user_id"
)
SELECT '9d70bf27-e67f-4c37-b3e1-dfb6a79db816'::uuid, 'lid', pb."lid_id",
       'consume', 2000, oi."order_id", oi."id",
       'Consumed remaining fulfilled lid reservation during reconciliation',
       '74ac89d6-0f6a-4813-8194-40a68301ea05',
       '63f50fed-3f2e-464d-82d0-b0e8dcea4812'::uuid
FROM "order_items" oi
JOIN "product_bundles" pb ON pb."id" = oi."product_bundle_id"
WHERE oi."id" = '8468bfb9-1e44-44fd-bcd1-42f47564efdc'
ON CONFLICT ("id") DO NOTHING;--> statement-breakpoint

-- Meltin Pot and Mökki: record the final dome-lid handoff and consume the
-- target Dabba lid reservation created by the paid-order bundle substitution.
INSERT INTO "order_line_item_progress_events" (
  "id", "order_line_item_id", "stage", "component_item_type", "quantity",
  "release_method", "released_to", "note", "event_date", "created_by_user_id"
)
SELECT v.id::uuid, v.order_item_id::uuid, 'released', 'lid', 500, 'delivery',
       v.released_to, 'Administrative reconciliation confirmed fulfilled order',
       v.event_date::timestamptz,
       '63f50fed-3f2e-464d-82d0-b0e8dcea4812'::uuid
FROM (VALUES
  ('ba6f865e-0bc5-40ae-b0ed-3db75ce1d384', '0ca373f2-85c4-4429-a45d-85c20c4174cb', 'Meltin'' Pot (Branch 2)', '2026-08-07T00:00:00Z'),
  ('fc6b20a4-f363-4e66-b81c-aa91e35bcd99', 'ae07bf58-f4bf-4b9e-b0cd-cabd496a4f6d', 'Mökki', '2026-08-06T00:00:00Z')
) AS v(id, order_item_id, released_to, event_date)
JOIN "order_items" oi ON oi."id" = v.order_item_id::uuid
ON CONFLICT ("id") DO NOTHING;--> statement-breakpoint

INSERT INTO "inventory_movements" (
  "id", "item_type", "lid_id", "movement_type", "quantity", "order_id",
  "order_item_id", "note", "reference", "created_by_user_id"
)
SELECT v.id::uuid, 'lid', pb."lid_id", 'consume', 500, oi."order_id", oi."id",
       'Consumed fulfilled dome-lid reservation during reconciliation', v.reference,
       '63f50fed-3f2e-464d-82d0-b0e8dcea4812'::uuid
FROM (VALUES
  ('9c9195c3-7256-4ca4-b6f3-85f63452d822', '0ca373f2-85c4-4429-a45d-85c20c4174cb', 'ba6f865e-0bc5-40ae-b0ed-3db75ce1d384'),
  ('f808a105-a0f2-4a5c-ab42-4cc6cfa69eb1', 'ae07bf58-f4bf-4b9e-b0cd-cabd496a4f6d', 'fc6b20a4-f363-4e66-b81c-aa91e35bcd99')
) AS v(id, order_item_id, reference)
JOIN "order_items" oi ON oi."id" = v.order_item_id::uuid
JOIN "product_bundles" pb ON pb."id" = oi."product_bundle_id"
ON CONFLICT ("id") DO NOTHING;--> statement-breakpoint

-- Preserve the second 500-unit 22oz print as a genuine overrun without
-- incorrectly consuming reservation twice for the same bundle line.
UPDATE "inventory_movements"
SET "movement_type" = 'adjustment_out',
    "note" = 'Deducted printed bundle overrun outside its line reservation'
WHERE "id" = 'e47ba5a3-f5f8-4ee4-a3c7-dd50edab4ebe';--> statement-breakpoint

UPDATE "orders"
SET "status" = 'completed', "updated_at" = now()
WHERE "id" IN (
  '6592f8c9-bd01-4b12-a39e-e90244ad34e9',
  '6e4511a6-c1d0-4bc3-b286-1e3535d89c5a',
  '8af2cc60-d36c-4b3c-9a4f-346aa48d10c3',
  '79b64f7a-cc76-402d-a470-629de34a1e19',
  '22422820-a7a2-44c5-a9be-e1dd468ff34d'
);--> statement-breakpoint
