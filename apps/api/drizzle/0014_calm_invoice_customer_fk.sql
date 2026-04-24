ALTER TABLE "invoices"
ADD CONSTRAINT "invoices_customer_id_customers_id_fk"
FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id")
ON DELETE restrict
ON UPDATE no action;
