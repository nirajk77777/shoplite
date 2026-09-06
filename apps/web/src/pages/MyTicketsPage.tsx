import { useEffect, useState } from "react";
import { Link } from "react-router";
import type { ReporterTicket } from "../api/portal";
import { useCustomer } from "../app/CustomerContext";
import { usePortal } from "../app/PortalContext";
import { isSettled, progressOf } from "../lib/tickets";

/**
 * How often the page re-reads a Ticket that is still open. The agent works in seconds, and
 * the customer is sitting on this page waiting for the Reply, so it is short.
 */
export const MY_TICKETS_POLL_MS = 3000;

/**
 * What the customer sees after reporting a problem: their own Tickets, how far along each one
 * is, and the Reply once it lands. The page keeps re-reading while anything is still open and
 * stops as soon as everything has closed, so a finished page is not polling the portal.
 */
export function MyTicketsPage() {
  const portal = usePortal();
  const { customer } = useCustomer();
  const [tickets, setTickets] = useState<ReporterTicket[] | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const email = customer?.email ?? null;

  useEffect(() => {
    setTickets(null);
    setFailed(null);
    if (!email) return;

    let watching = true;
    let timer: ReturnType<typeof setTimeout> | undefined;

    // Each read schedules the next one, so a slow portal is never asked twice at once and a
    // page whose Tickets have all closed schedules nothing further. A read that fails says so
    // on the page and then waits like any other: the customer is here for a Reply that is
    // still coming, and one unreachable moment should not end the wait. It is said on the
    // page rather than as a toast because a toast about the portal being unreachable would
    // offer to report the problem to that same portal.
    const poll = async () => {
      try {
        const found = await portal.listReporterTickets(email);
        if (!watching) return;
        setTickets(found);
        setFailed(null);
        if (found.every(isSettled)) return;
      } catch (error) {
        if (!watching) return;
        setFailed(error instanceof Error ? error.message : "Support could not be reached.");
      }
      timer = setTimeout(poll, MY_TICKETS_POLL_MS);
    };
    void poll();

    return () => {
      watching = false;
      clearTimeout(timer);
    };
  }, [portal, email]);

  return (
    <section className="page">
      <h1 className="display">My tickets</h1>
      <p className="tickets-note">
        Anything you have reported to us, and what we found out. We answer here as soon as we know
        what went wrong.
      </p>

      {failed && <p className="tickets-failed">{failed}</p>}

      {tickets === null && !failed && <p className="muted">Loading your tickets…</p>}

      {tickets?.length === 0 && (
        <div className="empty">
          <p>Nothing reported yet.</p>
          <Link to="/" className="button button--primary">
            Browse the shop
          </Link>
        </div>
      )}

      {tickets && tickets.length > 0 && (
        <ul className="tickets">
          {tickets.map((ticket) => (
            <TicketCard key={ticket.id} ticket={ticket} />
          ))}
        </ul>
      )}
    </section>
  );
}

function TicketCard({ ticket }: { ticket: ReporterTicket }) {
  const settled = isSettled(ticket);
  return (
    <li className={`ticket${settled ? " ticket--settled" : ""}`}>
      <div className="ticket__head">
        <h2 className="ticket__title">{ticket.title}</h2>
        <span className={`ticket__state${settled ? "" : " ticket__state--open"}`}>
          {progressOf(ticket)}
        </span>
      </div>
      <p className="ticket__body">{ticket.body}</p>

      {ticket.reply ? (
        <blockquote className="ticket__reply">{ticket.reply}</blockquote>
      ) : (
        <p className="ticket__waiting">We will write back here as soon as we know more.</p>
      )}

      <p className="ticket__meta mono muted">
        {new Date(ticket.createdAt).toLocaleString()}
        {ticket.traceId ? ` · ${ticket.traceId}` : ""}
      </p>
    </li>
  );
}
