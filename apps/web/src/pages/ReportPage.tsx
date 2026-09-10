import { type FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router";
import { useCustomer } from "../app/CustomerContext";
import { usePortal } from "../app/PortalContext";
import { useToasts } from "../app/ToastContext";
import { pageName, reportFrom, type StorePage, storePages } from "../lib/tickets";

/**
 * How a customer reports something that never failed loudly: pictures that do not load, a
 * total that looks wrong, a page that is slower than it was. The error toast reports the
 * failures the store knows about; this page is for the ones only the customer has noticed.
 * The Ticket is opened as the signed-in customer, with no trace id, and the customer reads the
 * Reply on My tickets exactly as they would for a reported failure.
 */
export function ReportPage() {
  const portal = usePortal();
  const { customer } = useCustomer();
  const { notify } = useToasts();
  const navigate = useNavigate();
  const [summary, setSummary] = useState("");
  const [details, setDetails] = useState("");
  const [page, setPage] = useState<StorePage | "">("");
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!customer) return;
    setSending(true);
    setFailed(null);
    try {
      await portal.openTicket({
        reporterEmail: customer.email,
        ...reportFrom({ summary, details, page: page || undefined }),
      });
      notify({
        tone: "success",
        title: "Thanks — we're looking into it.",
        detail: "We will write back on My tickets as soon as we know what went wrong.",
      });
      navigate("/tickets");
    } catch (error) {
      // Said under the form rather than as a toast: an error toast would offer to report the
      // problem to the same portal that could not be reached.
      setFailed(error instanceof Error ? error.message : "Support could not be reached.");
      setSending(false);
    }
  }

  return (
    <section className="page">
      <h1 className="display">Report a problem</h1>
      <p className="tickets-note">
        Something not working, but no error message to report it from? Tell us in your own words. We
        answer on <Link to="/tickets">My tickets</Link>.
      </p>

      <form className="report" onSubmit={submit}>
        <fieldset className="report__fields" disabled={sending || !customer}>
          <label className="field">
            <span className="field__label">What went wrong?</span>
            <input
              className="input"
              value={summary}
              onChange={(event) => setSummary(event.target.value)}
              placeholder="Product pictures are not loading"
              maxLength={120}
              required
            />
          </label>
          <label className="field">
            <span className="field__label">Tell us more</span>
            <textarea
              className="input"
              value={details}
              onChange={(event) => setDetails(event.target.value)}
              placeholder="What you were doing, what you expected, and what happened instead."
              rows={5}
              required
            />
          </label>
          <label className="field">
            <span className="field__label">Where did you notice it?</span>
            <select
              className="input"
              value={page}
              onChange={(event) => setPage(event.target.value as StorePage | "")}
            >
              <option value="">Not sure, or somewhere else</option>
              {storePages.map((path) => (
                <option key={path} value={path}>
                  {capitalise(pageName(path))}
                </option>
              ))}
            </select>
          </label>
        </fieldset>

        {!customer && <p className="report__hint">Pick who you are signed in as first.</p>}
        {failed && <p className="tickets-failed">{failed}</p>}

        <button
          type="submit"
          className="button button--primary button--wide"
          disabled={sending || !customer}
        >
          {sending ? "Reporting…" : "Report it"}
        </button>
        <p className="report__hint">
          If the store showed you an error message, the <strong>Report a problem</strong> button on
          that message sends us its reference as well.
        </p>
      </form>
    </section>
  );
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
