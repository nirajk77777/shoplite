import { describe, expect, it } from "vitest";
import type { ReporterTicket } from "../api/portal";
import { isSettled, progressOf, reportFrom, ticketFor } from "./tickets";

const ticket = (over: Partial<ReporterTicket>): ReporterTicket => ({
  id: "70000000-0000-4000-8000-000000000001",
  title: "Checkout failed",
  body: "I was paying for my cart",
  traceId: null,
  status: "new",
  outcome: null,
  reply: null,
  createdAt: "2026-09-07T09:00:00.000Z",
  closedAt: null,
  ...over,
});

describe("progressOf", () => {
  it("says where an open Ticket has got to, without the portal's own words", () => {
    expect(progressOf(ticket({ status: "new" }))).toBe("Received");
    expect(progressOf(ticket({ status: "investigating" }))).toBe("Being looked into");
    expect(progressOf(ticket({ status: "awaiting_approval" }))).toBe("Waiting on a review");
  });

  it("says how a closed Ticket ended, which is what the customer wants to know", () => {
    expect(progressOf(ticket({ status: "closed", outcome: "answered" }))).toBe("Answered");
    expect(progressOf(ticket({ status: "closed", outcome: "data_fixed" }))).toBe("Fixed");
    expect(progressOf(ticket({ status: "closed", outcome: "escalated" }))).toBe("With our team");
  });

  it("falls back to closed when a closed Ticket somehow has no Outcome", () => {
    expect(progressOf(ticket({ status: "closed", outcome: null }))).toBe("Closed");
  });
});

describe("isSettled", () => {
  it("is a Ticket that has closed, which is when there is nothing left to wait for", () => {
    expect(isSettled(ticket({ status: "closed", outcome: "answered" }))).toBe(true);
    expect(isSettled(ticket({ status: "acting" }))).toBe(false);
  });
});

describe("ticketFor", () => {
  it("writes what the customer was doing, where, and what the store said", () => {
    expect(
      ticketFor({ title: "Checkout failed", doing: "paying for my cart", page: "/checkout" }),
    ).toEqual({
      title: "Checkout failed",
      body: 'I was paying for my cart on the checkout page when the store showed "Checkout failed".',
    });
  });

  it("still says where it happened when nobody said what they were doing", () => {
    expect(ticketFor({ title: "Could not load your cart", page: "/cart" }).body).toBe(
      'The store showed "Could not load your cart" while I was on the cart page.',
    );
  });

  it("names a page it has no words for by its path", () => {
    expect(ticketFor({ title: "Gone", page: "/somewhere/new" }).body).toContain("/somewhere/new");
  });
});

describe("reportFrom", () => {
  it("keeps the customer's own line as the title and their story as the body", () => {
    expect(
      reportFrom({
        summary: "  Product pictures are not loading ",
        details: "Every picture on the catalog is a grey box since this morning.\n",
      }),
    ).toEqual({
      title: "Product pictures are not loading",
      body: "Every picture on the catalog is a grey box since this morning.",
    });
  });

  it("names the page they noticed it on the way a reported failure would", () => {
    expect(
      reportFrom({
        summary: "Cart total looks wrong",
        details: "It says two items.",
        page: "/cart",
      }).body,
    ).toBe("It says two items. I noticed this on the cart page.");
  });
});
