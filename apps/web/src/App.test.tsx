import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { App } from "./App";
import { ApiError, type Cart, type Customer, type Product, type ShopLiteApi } from "./api/client";
import type { PortalApi, ReporterTicket } from "./api/portal";
import { MY_TICKETS_POLL_MS } from "./pages/MyTicketsPage";

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

const openedTicket: ReporterTicket = {
  id: "70000000-0000-4000-8000-000000000001",
  title: "Checkout failed",
  body: "I was paying for my cart on the checkout page.",
  traceId: "4bf92f3577b34da6a3ce929d0e0e4736",
  status: "new",
  outcome: null,
  reply: null,
  createdAt: "2026-09-07T09:00:00.000Z",
  closedAt: null,
};

function fakePortal(overrides: Partial<PortalApi> = {}): PortalApi {
  return {
    openTicket: vi.fn(async () => openedTicket),
    listReporterTickets: vi.fn(async () => []),
    ...overrides,
  };
}

function renderApp(api: ShopLiteApi, path = "/", portal: PortalApi = fakePortal()) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App api={api} portal={portal} />
    </MemoryRouter>,
  );
}

/** A cart with one mug in it, so checkout has something to fail on. */
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

/** The declined card of demo moment one: pay with it and read the toast that comes back. */
async function failCheckout(traceId: string | null, portal: PortalApi) {
  const api = fakeApi({
    getCart: vi.fn(async () => cartWithMug),
    checkout: vi.fn(async () => {
      throw new ApiError("Checkout failed", 402, traceId);
    }),
  });
  renderApp(api, "/checkout", portal);
  const user = userEvent.setup();

  await user.type(await screen.findByLabelText("Card number"), "4000000000000002");
  await user.click(screen.getByRole("button", { name: "Pay $12.00" }));
  return { user, toast: await screen.findByRole("alert") };
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

describe("reporting a problem", () => {
  it("opens a Ticket carrying the Reporter, the trace id, and what they were doing", async () => {
    const traceId = "4bf92f3577b34da6a3ce929d0e0e4736";
    const portal = fakePortal();
    const { user, toast } = await failCheckout(traceId, portal);

    await user.click(within(toast).getByRole("button", { name: "Report a problem" }));

    await waitFor(() =>
      expect(portal.openTicket).toHaveBeenCalledWith({
        reporterEmail: ava.email,
        traceId,
        title: "Checkout failed",
        body: 'I was paying for my cart on the checkout page when the store showed "Checkout failed".',
      }),
    );
  });

  it("confirms it was reported, and points the customer at My tickets", async () => {
    const { user, toast } = await failCheckout("4bf92f3577b34da6a3ce929d0e0e4736", fakePortal());

    await user.click(within(toast).getByRole("button", { name: "Report a problem" }));

    const link = await within(toast).findByRole("link", { name: /my tickets/i });
    expect(link).toHaveAttribute("href", "/tickets");
    expect(within(toast).queryByRole("button", { name: "Report a problem" })).toBeNull();
  });
});

describe("My tickets", () => {
  const closedTicket: ReporterTicket = {
    ...openedTicket,
    status: "closed",
    outcome: "answered",
    reply:
      "Your bank declined the payment for insufficient funds, so nothing was charged. Please try another card.",
    closedAt: "2026-09-07T09:02:00.000Z",
  };

  it("lists the signed-in customer's Tickets with how far along each one is", async () => {
    const portal = fakePortal({ listReporterTickets: vi.fn(async () => [closedTicket]) });
    renderApp(fakeApi(), "/tickets", portal);

    expect(await screen.findByText("Checkout failed")).toBeInTheDocument();
    expect(screen.getByText("Answered")).toBeInTheDocument();
    expect(screen.getByText(/declined the payment for insufficient funds/i)).toBeInTheDocument();
    expect(portal.listReporterTickets).toHaveBeenCalledWith(ava.email);
  });

  it("keeps re-reading an open Ticket until it closes, then stops", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const listReporterTickets = vi
        .fn<PortalApi["listReporterTickets"]>()
        .mockResolvedValueOnce([openedTicket])
        .mockResolvedValue([closedTicket]);
      renderApp(fakeApi(), "/tickets", fakePortal({ listReporterTickets }));

      expect(await screen.findByText("Received")).toBeInTheDocument();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(MY_TICKETS_POLL_MS);
      });
      expect(await screen.findByText("Answered")).toBeInTheDocument();

      // Every Ticket has closed, so the page has nothing left to wait for.
      const readsSoFar = listReporterTickets.mock.calls.length;
      await act(async () => {
        await vi.advanceTimersByTimeAsync(MY_TICKETS_POLL_MS * 3);
      });
      expect(listReporterTickets).toHaveBeenCalledTimes(readsSoFar);
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps waiting after a read that failed, and clears the notice when one succeeds", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const listReporterTickets = vi
        .fn<PortalApi["listReporterTickets"]>()
        .mockRejectedValueOnce(new Error("Support is not reachable (503)"))
        .mockResolvedValue([closedTicket]);
      renderApp(fakeApi(), "/tickets", fakePortal({ listReporterTickets }));

      expect(await screen.findByText(/support is not reachable/i)).toBeInTheDocument();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(MY_TICKETS_POLL_MS);
      });

      expect(await screen.findByText("Answered")).toBeInTheDocument();
      expect(screen.queryByText(/support is not reachable/i)).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("says there is nothing to show before anything has been reported", async () => {
    renderApp(fakeApi(), "/tickets", fakePortal());

    expect(await screen.findByText(/nothing reported yet/i)).toBeInTheDocument();
  });
});

describe("moving around the store", () => {
  it("stamps a toast's page without re-reading the customers, which would blank the cart tag", async () => {
    const api = fakeApi();
    renderApp(api, "/");
    const user = userEvent.setup();

    await screen.findByRole("link", { name: /cart.*0 items/i });
    await user.click(screen.getByRole("link", { name: "Cart" }));
    await screen.findByRole("heading", { name: "Your cart" });

    expect(api.listCustomers).toHaveBeenCalledTimes(1);
  });
});
