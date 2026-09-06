import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { App } from "./App";
import { ApiError, type Cart, type Customer, type Product, type ShopLiteApi } from "./api/client";

const ava: Customer = {
  id: "00000000-0000-4000-8000-000000000001",
  email: "ava.chen@example.com",
  name: "Ava Chen",
};

const mug: Product = {
  id: "00000000-0000-4000-9000-000000000001",
  sku: "MUG-01",
  name: "Stoneware Mug",
  description: "Hand-glazed 350 ml mug.",
  priceCents: 1200,
  imageUrl: "/images/mug.jpg",
};

function fakeApi(overrides: Partial<ShopLiteApi> = {}): ShopLiteApi {
  const emptyCart: Cart = {
    id: "cart-1",
    customerId: ava.id,
    discountCode: null,
    items: [],
    totals: { itemCount: 0, subtotalCents: 0, discountCents: 0, totalCents: 0 },
  };
  return {
    listCustomers: vi.fn(async () => [ava]),
    listProducts: vi.fn(async () => [mug]),
    getCart: vi.fn(async () => emptyCart),
    addItem: vi.fn(async () => emptyCart),
    removeItem: vi.fn(async () => emptyCart),
    applyDiscount: vi.fn(async () => emptyCart),
    clearDiscount: vi.fn(async () => emptyCart),
    checkout: vi.fn(async () => {
      throw new Error("not in this test");
    }),
    ...overrides,
  };
}

function renderApp(api: ShopLiteApi, path = "/") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App api={api} />
    </MemoryRouter>,
  );
}

describe("header cart badge", () => {
  it("shows the count and total from the cart totals row, not a sum of the lines", async () => {
    // The lines say two mugs for $24.00; the totals row still says three items for $49.99.
    // The badge must trust the totals row, which is what makes the stale total bug visible.
    const staleCart: Cart = {
      id: "cart-1",
      customerId: ava.id,
      discountCode: null,
      items: [
        {
          productId: mug.id,
          unitPriceCents: 1200,
          quantity: 2,
          name: mug.name,
          sku: mug.sku,
          lineTotalCents: 2400,
        },
      ],
      totals: { itemCount: 3, subtotalCents: 4999, discountCents: 0, totalCents: 4999 },
    };
    renderApp(fakeApi({ getCart: vi.fn(async () => staleCart) }));

    const badge = await screen.findByRole("link", { name: /cart.*3 items/i });

    expect(badge).toHaveTextContent("3 items");
    expect(badge).toHaveTextContent("$49.99");
    expect(badge).not.toHaveTextContent("$24.00");
  });
});

describe("checkout failure", () => {
  it("shows the generic message and the trace id from the failed request", async () => {
    const traceId = "4bf92f3577b34da6a3ce929d0e0e4736";
    const cartWithMug: Cart = {
      id: "cart-1",
      customerId: ava.id,
      discountCode: null,
      items: [
        {
          productId: mug.id,
          unitPriceCents: 1200,
          quantity: 1,
          name: mug.name,
          sku: mug.sku,
          lineTotalCents: 1200,
        },
      ],
      totals: { itemCount: 1, subtotalCents: 1200, discountCents: 0, totalCents: 1200 },
    };
    const api = fakeApi({
      getCart: vi.fn(async () => cartWithMug),
      checkout: vi.fn(async () => {
        throw new ApiError("Checkout failed", 402, traceId);
      }),
    });
    renderApp(api, "/checkout");
    const user = userEvent.setup();

    await user.type(await screen.findByLabelText("Card number"), "4000000000000002");
    await user.click(screen.getByRole("button", { name: "Pay $12.00" }));

    const toast = await screen.findByRole("alert");
    expect(within(toast).getByText("Checkout failed")).toBeInTheDocument();
    expect(within(toast).getByText(traceId)).toBeInTheDocument();
    expect(toast).not.toHaveTextContent(/insufficient|declined/i);
    expect(api.checkout).toHaveBeenCalledWith(ava.id, {
      number: "4000000000000002",
      expMonth: 12,
      expYear: new Date().getFullYear() + 3,
    });
  });
});
