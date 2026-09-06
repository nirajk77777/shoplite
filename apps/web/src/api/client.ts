// Shapes mirror what apps/api returns. Prices are integers in cents.

import { createCall } from "./json";

export type Customer = { id: string; email: string; name: string };

export type Product = {
  id: string;
  sku: string;
  name: string;
  description: string;
  priceCents: number;
  imageUrl: string;
};

export type CartItem = {
  productId: string;
  unitPriceCents: number;
  quantity: number;
  name: string;
  sku: string;
  lineTotalCents: number;
};

/** Comes straight from the cart_totals row, which is why the badge can go stale. */
export type CartTotals = {
  itemCount: number;
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
};

export type Cart = {
  id: string;
  customerId: string;
  discountCode: string | null;
  items: CartItem[];
  totals: CartTotals;
};

export type Card = { number: string; expMonth: number; expYear: number };

export type Order = {
  id: string;
  status: "paid";
  discountCode: string | null;
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  lines: { productId: string; unitPriceCents: number; quantity: number }[];
  createdAt: string;
};

/**
 * A non-2xx response from the API. `message` is the API's own error text, which
 * for a declined card is deliberately generic; `traceId` is the request's
 * trace so the customer can quote it when reporting the problem.
 */
export class ApiError extends Error {
  override readonly name = "ApiError";

  constructor(
    message: string,
    readonly status: number,
    readonly traceId: string | null,
  ) {
    super(message);
  }
}

export type ShopLiteApi = {
  listCustomers(): Promise<Customer[]>;
  listProducts(): Promise<Product[]>;
  getCart(customerId: string): Promise<Cart>;
  addItem(customerId: string, productId: string, quantity?: number): Promise<Cart>;
  removeItem(customerId: string, productId: string): Promise<Cart>;
  applyDiscount(customerId: string, code: string): Promise<Cart>;
  clearDiscount(customerId: string): Promise<Cart>;
  checkout(customerId: string, card: Card): Promise<Order>;
};

export type ApiOptions = {
  fetchImpl?: typeof fetch;
  /** Where the API is reachable from the browser. The dev server proxies `/api` to it. */
  baseUrl?: string;
};

export function createApi({ fetchImpl = fetch, baseUrl = "/api" }: ApiOptions = {}): ShopLiteApi {
  const call = createCall({
    fetchImpl,
    baseUrl,
    failed: ({ message, status, response }) =>
      new ApiError(
        message ?? `Request failed (${status})`,
        status,
        response.headers.get("x-trace-id"),
      ),
  });

  const customer = (id: string) => `/customers/${id}`;

  return {
    listCustomers: () => call("GET", "/customers"),
    listProducts: () => call("GET", "/products"),
    getCart: (id) => call("GET", `${customer(id)}/cart`),
    addItem: (id, productId, quantity = 1) =>
      call("POST", `${customer(id)}/cart/items`, { productId, quantity }),
    removeItem: (id, productId) => call("DELETE", `${customer(id)}/cart/items/${productId}`),
    applyDiscount: (id, code) => call("POST", `${customer(id)}/cart/discount`, { code }),
    clearDiscount: (id) => call("DELETE", `${customer(id)}/cart/discount`),
    checkout: async (id, card) => {
      const { order } = await call<{ order: Order }>("POST", `${customer(id)}/checkout`, { card });
      return order;
    },
  };
}
