import { sql } from "drizzle-orm";
import type { Db } from "./client";
import { customers, discountCodes, products } from "./schema";

/**
 * Seed data with fixed ids so the storefront picker, the demo reset, and the
 * integration tests all agree on who the customers are and what is for sale.
 */
export const seedCustomers = [
  { id: "00000000-0000-4000-8000-000000000001", email: "ava.chen@example.com", name: "Ava Chen" },
  {
    id: "00000000-0000-4000-8000-000000000002",
    email: "liam.okafor@example.com",
    name: "Liam Okafor",
  },
  {
    id: "00000000-0000-4000-8000-000000000003",
    email: "maya.singh@example.com",
    name: "Maya Singh",
  },
  {
    id: "00000000-0000-4000-8000-000000000004",
    email: "noah.brandt@example.com",
    name: "Noah Brandt",
  },
  {
    id: "00000000-0000-4000-8000-000000000005",
    email: "sofia.reyes@example.com",
    name: "Sofia Reyes",
  },
] as const;

export const seedProducts = [
  {
    id: "00000000-0000-4000-9000-000000000001",
    sku: "MUG-01",
    name: "Stoneware Mug",
    description: "Hand-glazed 350 ml mug. Dishwasher safe.",
    priceCents: 1200,
    imageUrl: "/images/mug.jpg",
  },
  {
    id: "00000000-0000-4000-9000-000000000002",
    sku: "POSTER-01",
    name: "City Map Poster",
    description: "A2 screen print on recycled paper.",
    priceCents: 2599,
    imageUrl: "/images/poster.jpg",
  },
  {
    id: "00000000-0000-4000-9000-000000000003",
    sku: "TEE-01",
    name: "Organic Cotton Tee",
    description: "Unisex fit, heavyweight jersey.",
    priceCents: 2900,
    imageUrl: "/images/tee.jpg",
  },
  {
    id: "00000000-0000-4000-9000-000000000004",
    sku: "NOTEBOOK-01",
    name: "Dot Grid Notebook",
    description: "192 pages, lay-flat binding.",
    priceCents: 1450,
    imageUrl: "/images/notebook.jpg",
  },
  {
    id: "00000000-0000-4000-9000-000000000005",
    sku: "CANDLE-01",
    name: "Soy Candle, Cedar",
    description: "40 hour burn time.",
    priceCents: 1800,
    imageUrl: "/images/candle.jpg",
  },
  {
    id: "00000000-0000-4000-9000-000000000006",
    sku: "TOTE-01",
    name: "Canvas Tote",
    description: "Reinforced handles, inner pocket.",
    priceCents: 2200,
    imageUrl: "/images/tote.jpg",
  },
  {
    id: "00000000-0000-4000-9000-000000000007",
    sku: "SOCKS-01",
    name: "Wool Socks, 2 pack",
    description: "Merino blend, sizes 39 to 46.",
    priceCents: 1600,
    imageUrl: "/images/socks.jpg",
  },
  {
    id: "00000000-0000-4000-9000-000000000008",
    sku: "BOTTLE-01",
    name: "Insulated Bottle",
    description: "750 ml, keeps drinks cold for 24 hours.",
    priceCents: 3400,
    imageUrl: "/images/bottle.jpg",
  },
] as const;

export const seedDiscountCodes = [
  { code: "SALE10", kind: "percent", value: 10, minSubtotalCents: 0, active: true },
  { code: "FLAT5", kind: "fixed", value: 500, minSubtotalCents: 2000, active: true },
  { code: "EXPIRED20", kind: "percent", value: 20, minSubtotalCents: 0, active: false },
] as const;

/** Empties every ShopLite table and reinserts the seed. Safe to run repeatedly. */
export async function seed(db: Db): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.execute(sql`
      TRUNCATE shoplite.payments, shoplite.orders, shoplite.cart_totals, shoplite.cart_items,
               shoplite.carts, shoplite.discount_codes, shoplite.products, shoplite.customers
    `);
    await tx.insert(customers).values([...seedCustomers]);
    await tx.insert(products).values([...seedProducts]);
    await tx.insert(discountCodes).values([...seedDiscountCodes]);
  });
}
