import { and, asc, eq, ilike } from "drizzle-orm"

import type { DatabaseClient } from "../../db/client.js"
import { productBundles, type ProductBundle } from "../../db/schema/index.js"
import type {
  CreateProductBundleInput,
  UpdateProductBundleInput,
} from "./product-bundles.schemas.js"

export class ProductBundlesRepository {
  constructor(private readonly db: DatabaseClient) {}

  async list(options: { includeInactive?: boolean; name?: string } = {}): Promise<ProductBundle[]> {
    const where = and(
      options.includeInactive ? undefined : eq(productBundles.isActive, true),
      options.name ? ilike(productBundles.name, `%${options.name}%`) : undefined,
    )

    return this.db.select().from(productBundles).where(where).orderBy(asc(productBundles.name))
  }

  async findById(id: string): Promise<ProductBundle | undefined> {
    const rows = await this.db
      .select()
      .from(productBundles)
      .where(eq(productBundles.id, id))
      .limit(1)

    return rows[0]
  }

  async create(input: CreateProductBundleInput): Promise<ProductBundle> {
    const rows = await this.db.insert(productBundles).values(input).returning()
    return requireProductBundle(rows[0], "Failed to create product bundle")
  }

  async update(id: string, input: UpdateProductBundleInput): Promise<ProductBundle | undefined> {
    const rows = await this.db
      .update(productBundles)
      .set({
        ...input,
        updatedAt: new Date(),
      })
      .where(eq(productBundles.id, id))
      .returning()

    return rows[0]
  }
}

function requireProductBundle(
  productBundle: ProductBundle | undefined,
  message: string,
): ProductBundle {
  if (!productBundle) {
    throw new Error(message)
  }

  return productBundle
}
