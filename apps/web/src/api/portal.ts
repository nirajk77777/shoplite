// The Incident Resolver portal, as the storefront needs it: a customer opens a Ticket about
// something that just failed, and reads the Reply on "My tickets". Shapes mirror what
// portal-api returns; the storefront never sees the timeline or the approval gate.

import { createCall } from "./json";

/** Where a Ticket is in its lifecycle. `closed` is the only status that carries a Reply. */
export type TicketStatus =
  | "new"
  | "triaging"
  | "investigating"
  | "awaiting_approval"
  | "acting"
  | "closed";

/** How a closed Ticket ended. */
export type TicketOutcome = "answered" | "data_fixed" | "fix_proposed" | "escalated";

/** One of the signed-in customer's Tickets, as the portal serves it back to them. */
export type ReporterTicket = {
  id: string;
  title: string;
  body: string;
  traceId: string | null;
  status: TicketStatus;
  outcome: TicketOutcome | null;
  reply: string | null;
  createdAt: string;
  closedAt: string | null;
};

/** A Ticket as the storefront opens one: always from a customer, the one who is signed in. */
export type NewTicket = {
  reporterEmail: string;
  /** The trace id from the error toast, when the failed request returned one. */
  traceId?: string | null;
  title: string;
  body: string;
};

export type PortalApi = {
  /** Opens a customer-source Ticket and starts its run. */
  openTicket(ticket: NewTicket): Promise<ReporterTicket>;
  /** The Tickets this Reporter has opened, newest first, with their Replies. */
  listReporterTickets(email: string): Promise<ReporterTicket[]>;
};

export type PortalOptions = {
  fetchImpl?: typeof fetch;
  /** Where the portal is reachable from the browser. The dev server proxies `/portal` to it. */
  baseUrl?: string;
};

/** A non-2xx reply from the portal, in the words it refused with. */
export class PortalError extends Error {
  override readonly name = "PortalError";
}

export function createPortal({
  fetchImpl = fetch,
  baseUrl = "/portal",
}: PortalOptions = {}): PortalApi {
  const call = createCall({
    fetchImpl,
    baseUrl,
    failed: ({ message, status }) =>
      new PortalError(message ?? `Support is not reachable (${status})`),
  });

  return {
    openTicket: ({ reporterEmail, traceId, title, body }) =>
      call("POST", "/tickets", {
        source: "customer",
        reporterEmail,
        // A failure with no trace id is still worth reporting; the field is simply left off.
        ...(traceId ? { traceId } : {}),
        title,
        body,
      }),

    listReporterTickets: async (email) => {
      const { tickets } = await call<{ tickets: ReporterTicket[] }>(
        "GET",
        `/reporters/${encodeURIComponent(email)}/tickets`,
      );
      return tickets;
    },
  };
}
