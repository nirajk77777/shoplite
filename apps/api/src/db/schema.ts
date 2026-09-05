import { sql } from "drizzle-orm";
import {
  boolean,
  integer,
  jsonb,
  pgSchema,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type { CartLine } from "../domain/cart";

/** ShopLite owns the `shoplite` schema inside the shared Postgres instance. */
export const shoplite = pgSchema("shoplite");

const id = () => uuid("id").primaryKey().default(sql`gen_random_uuid()`);
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const customers = shoplite.table("customers", {
  id: id(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  createdAt: createdAt(),
});

export const products = shoplite.table("products", {
  id: id(),
  sku: text("sku").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  priceCents: integer("price_cents").notNull(),
  imageUrl: text("image_url").notNull(),
  createdAt: createdAt(),
});

export const discountCodes = shoplite.table("discount_codes", {
  code: text("code").primaryKey(),
  kind: text("kind").$type<"percent" | "fixed">().notNull(),
  /** A percentage for `percent` codes, an amount in cents for `fixed` codes. */
  value: integer("value").notNull(),
  minSubtotalCents: integer("min_subtotal_cents").notNull().default(0),
  active: boolean("active").notNull().default(true),
  createdAt: createdAt(),
});

export const carts = shoplite.table("carts", {
  id: id(),
  customerId: uuid("customer_id")
    .notNull()
    .references(() => customers.id),
  status: text("status").$type<"open" | "checked_out">().notNull().default("open"),
  discountCode: text("discount_code").references(() => discountCodes.code),
  createdAt: createdAt(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const cartItems = shoplite.table(
  "cart_items",
  {
    id: id(),
    cartId: uuid("cart_id")
      .notNull()
      .references(() => carts.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id),
    /** Price at the time the line was added, so the cart is stable if the catalog changes. */
    unitPriceCents: integer("unit_price_cents").notNull(),
    quantity: integer("quantity").notNull(),
    createdAt: createdAt(),
  },
  (table) => [uniqueIndex("cart_items_cart_product_idx").on(table.cartId, table.productId)],
);

/**
 * Denormalised copy of each cart's item count and totals.
 *
 * The storefront header shows the cart badge (count and total) on every page,
 * so we keep these numbers here and read one row by cart id instead of joining
 * cart_items to products on each request. The row is refreshed whenever the
 * cart changes.
 */
export const cartTotals = shoplite.table("cart_totals", {
  cartId: uuid("cart_id")
    .primaryKey()
    .references(() => carts.id, { onDelete: "cascade" }),
  itemCount: integer("item_count").notNull().default(0),
  subtotalCents: integer("subtotal_cents").notNull().default(0),
  discountCents: integer("discount_cents").notNull().default(0),
  totalCents: integer("total_cents").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const orders = shoplite.table("orders", {
  id: id(),
  customerId: uuid("customer_id")
    .notNull()
    .references(() => customers.id),
  cartId: uuid("cart_id")
    .notNull()
    .references(() => carts.id),
  status: text("status").$type<"paid">().notNull().default("paid"),
  discountCode: text("discount_code"),
  subtotalCents: integer("subtotal_cents").notNull(),
  discountCents: integer("discount_cents").notNull(),
  totalCents: integer("total_cents").notNull(),
  /** The priced lines exactly as they were charged. */
  lines: jsonb("lines").$type<CartLine[]>().notNull(),
  createdAt: createdAt(),
});

export const payments = shoplite.table("payments", {
  id: id(),
  customerId: uuid("customer_id")
    .notNull()
    .references(() => customers.id),
  cartId: uuid("cart_id")
    .notNull()
    .references(() => carts.id),
  /** Set only when the charge was approved and an order was written. */
  orderId: uuid("order_id").references(() => orders.id),
  amountCents: integer("amount_cents").notNull(),
  cardLast4: text("card_last4").notNull(),
  status: text("status").$type<"approved" | "declined">().notNull(),
  declineCode: text("decline_code"),
  declineMessage: text("decline_message"),
  gatewayReference: text("gateway_reference"),
  createdAt: createdAt(),
});
