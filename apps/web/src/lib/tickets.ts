// Tickets in the customer's own words: the one they are about to open from a failure, and how
// far along the ones they have opened are. The portal's own vocabulary — status, Outcome — is
// for the people working the queue, so none of it reaches the page.

import type { ReporterTicket, TicketOutcome, TicketStatus } from "../api/portal";

/** What the store showed the customer, and where they were when it did. */
export type Failure = {
  /** What the store said went wrong: the error toast's own title. */
  title: string;
  /** What the customer was doing, in their words, when the page knows it. */
  doing?: string | undefined;
  /** The path they were on when it happened. */
  page: string;
};

/** The pages of the store a customer can name when nothing failed loudly enough to be a toast. */
export const storePages = ["/", "/cart", "/checkout", "/tickets"] as const;
export type StorePage = (typeof storePages)[number];

const named: Record<StorePage, string> = {
  "/": "the shop page",
  "/cart": "the cart page",
  "/checkout": "the checkout page",
  "/tickets": "the my tickets page",
};

/** How the customer would name the page they were on. */
export function pageName(path: string): string {
  return (named as Record<string, string>)[path] ?? path;
}

/**
 * The Ticket a failure becomes. The agent reads the body, so it is written the way the
 * customer would put it: what they were doing, where in the store they were, and the words
 * the store gave them back. The trace id travels on the Ticket itself, not in the prose.
 */
export function ticketFor({ title, doing, page }: Failure): { title: string; body: string } {
  const where = pageName(page);
  const body = doing
    ? `I was ${doing} on ${where} when the store showed "${title}".`
    : `The store showed "${title}" while I was on ${where}.`;
  return { title, body };
}

/** What the customer typed on the report page: a line for the title, the rest for the body. */
export type Report = {
  /** What went wrong, in a line. Becomes the Ticket's title. */
  summary: string;
  /** The rest of the story: what they were doing, what they expected, what happened instead. */
  details: string;
  /** Where in the store they noticed it, when they can say. */
  page?: StorePage | undefined;
};

/**
 * The Ticket a report becomes. Nothing failed with a reference here, so the words are all the
 * agent has: the title is the customer's own line, the body their own story, and the page they
 * named goes on the end in the same phrasing a failure would have used.
 */
export function reportFrom({ summary, details, page }: Report): { title: string; body: string } {
  const title = summary.trim();
  const story = details.trim();
  const body = page ? `${story} I noticed this on ${pageName(page)}.` : story;
  return { title, body };
}

const whileOpen: Record<Exclude<TicketStatus, "closed">, string> = {
  new: "Received",
  triaging: "Being read",
  investigating: "Being looked into",
  awaiting_approval: "Waiting on a review",
  acting: "Being put right",
};

const whenClosed: Record<TicketOutcome, string> = {
  answered: "Answered",
  data_fixed: "Fixed",
  fix_proposed: "Fix on the way",
  escalated: "With our team",
};

/** How far along this Ticket is, or how it ended once it has closed. */
export function progressOf(ticket: ReporterTicket): string {
  if (ticket.status !== "closed") return whileOpen[ticket.status];
  return ticket.outcome ? whenClosed[ticket.outcome] : "Closed";
}

/** A Ticket that has closed: there is nothing more coming, so nothing left to poll for. */
export function isSettled(ticket: ReporterTicket): boolean {
  return ticket.status === "closed";
}
