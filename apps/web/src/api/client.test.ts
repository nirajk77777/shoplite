import { describe, expect, it, vi } from "vitest";
import { ApiError, createApi } from "./client";

const ava = "00000000-0000-4000-8000-000000000001";
const card = { number: "4000000000000002", expMonth: 12, expYear: 2030 };

function respond(status: number, body: unknown, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

describe("ShopLite API client", () => {
  it("raises the API's message and the trace id when checkout fails", async () => {
    const traceId = "4bf92f3577b34da6a3ce929d0e0e4736";
    const fetchImpl = vi.fn(async () =>
      respond(402, { error: "Checkout failed" }, { "x-trace-id": traceId }),
    );
    const api = createApi({ fetchImpl, baseUrl: "/api" });

    const failure = await api.checkout(ava, card).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(ApiError);
    expect(failure).toMatchObject({ status: 402, message: "Checkout failed", traceId });
    expect(fetchImpl).toHaveBeenCalledWith(
      `/api/customers/${ava}/checkout`,
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("reports a missing trace id as null rather than inventing one", async () => {
    const fetchImpl = vi.fn(async () => respond(400, { error: "Cart is empty" }));
    const api = createApi({ fetchImpl, baseUrl: "/api" });

    const failure = await api.checkout(ava, card).catch((error: unknown) => error);

    expect(failure).toMatchObject({ status: 400, message: "Cart is empty", traceId: null });
  });

  it("returns the order when checkout succeeds", async () => {
    const order = { id: "o-1", status: "paid", totalCents: 4499 };
    const fetchImpl = vi.fn(async () => respond(201, { order }));
    const api = createApi({ fetchImpl, baseUrl: "/api" });

    await expect(api.checkout(ava, card)).resolves.toEqual(order);
  });
});
