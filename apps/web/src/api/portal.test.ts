import { describe, expect, it, vi } from "vitest";
import { createPortal } from "./portal";

const ava = "ava.chen@example.com";

function respond(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const opened = {
  id: "70000000-0000-4000-8000-000000000001",
  source: "customer",
  reporterEmail: ava,
  traceId: "4bf92f3577b34da6a3ce929d0e0e4736",
  title: "Checkout failed",
  body: "I was paying for my cart",
  status: "new",
  outcome: null,
  reply: null,
  createdAt: "2026-09-07T09:00:00.000Z",
  closedAt: null,
};

describe("the portal client", () => {
  it("opens a customer Ticket carrying the Reporter, the trace id, and what they were doing", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => respond(201, opened));
    const portal = createPortal({ fetchImpl, baseUrl: "/portal" });

    await expect(
      portal.openTicket({
        reporterEmail: ava,
        traceId: opened.traceId,
        title: "Checkout failed",
        body: "I was paying for my cart",
      }),
    ).resolves.toMatchObject({ id: opened.id, status: "new" });

    const [url, init] = fetchImpl.mock.calls[0] ?? [];
    expect(url).toBe("/portal/tickets");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({
      source: "customer",
      reporterEmail: ava,
      traceId: opened.traceId,
      title: "Checkout failed",
      body: "I was paying for my cart",
    });
  });

  it("reads the Reporter's own Tickets, with the email escaped into the path", async () => {
    const closed = {
      ...opened,
      status: "closed",
      outcome: "answered",
      reply: "Your card was declined.",
    };
    const fetchImpl = vi.fn<typeof fetch>(async () => respond(200, { tickets: [closed] }));
    const portal = createPortal({ fetchImpl, baseUrl: "/portal" });

    await expect(portal.listReporterTickets("ava+shop@example.com")).resolves.toEqual([closed]);
    expect(fetchImpl.mock.calls[0]?.[0]).toBe("/portal/reporters/ava%2Bshop%40example.com/tickets");
  });

  it("raises what the portal said was wrong rather than a bare status", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      respond(400, {
        error: "Bad Request",
        message: "reporterEmail: A customer Ticket needs the reporter's email",
      }),
    );
    const portal = createPortal({ fetchImpl, baseUrl: "/portal" });

    await expect(portal.openTicket({ reporterEmail: "", title: "x", body: "y" })).rejects.toThrow(
      /needs the reporter's email/,
    );
  });
});
