import { useState } from "react";
import { Link } from "react-router";
import { useCustomer } from "../app/CustomerContext";
import { usePortal } from "../app/PortalContext";
import { type Toast, useToasts } from "../app/ToastContext";
import { ticketFor } from "../lib/tickets";

export function Toasts() {
  const { toasts, dismiss } = useToasts();
  if (toasts.length === 0) return null;

  return (
    <div className="toasts" aria-live="assertive">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role={toast.tone === "error" ? "alert" : "status"}
          className={`toast toast--${toast.tone}`}
        >
          <div className="toast__body">
            <p className="toast__title">{toast.title}</p>
            {toast.detail && <p className="toast__detail">{toast.detail}</p>}
            {toast.tone === "error" && (
              <>
                <p className="toast__ref">
                  <span className="toast__ref-label">Reference</span>
                  {toast.traceId ? (
                    <>
                      <code className="toast__trace">{toast.traceId}</code>
                      <CopyButton text={toast.traceId} />
                    </>
                  ) : (
                    <span className="toast__trace toast__trace--missing">none returned</span>
                  )}
                </p>
                <ReportProblem toast={toast} />
              </>
            )}
          </div>
          <button
            type="button"
            className="toast__close"
            onClick={() => dismiss(toast.id)}
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

/**
 * The one step between a customer seeing an error and the agent investigating it. The Ticket
 * carries who they are, the trace id of the request that failed, and what they were doing, so
 * nothing has to be retyped; once it is open the toast becomes the confirmation, and the
 * customer reads the Reply on My tickets rather than waiting on this page.
 */
function ReportProblem({ toast }: { toast: Toast }) {
  const portal = usePortal();
  const { customer } = useCustomer();
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  // Nobody is signed in, so there is no Reporter to open the Ticket as.
  if (!customer) return null;

  if (sent) {
    return (
      <p className="toast__done">
        Thanks — we're looking into it. Follow it on <Link to="/tickets">My tickets</Link>.
      </p>
    );
  }

  async function report() {
    if (!customer) return;
    setSending(true);
    setFailed(null);
    try {
      await portal.openTicket({
        reporterEmail: customer.email,
        traceId: toast.traceId,
        ...ticketFor({ title: toast.title, doing: toast.doing, page: toast.page }),
      });
      setSent(true);
    } catch (error) {
      // Reported inside the toast rather than as another one: a second error toast would
      // arrive with its own Report a problem button and no way to send it either.
      setFailed(error instanceof Error ? error.message : "Support could not be reached.");
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <p className="toast__actions">
        <button
          type="button"
          className="toast__report"
          disabled={sending}
          onClick={() => void report()}
        >
          {sending ? "Reporting…" : "Report a problem"}
        </button>
      </p>
      {failed && <p className="toast__failed">{failed}</p>}
    </>
  );
}

function CopyButton({ text }: { text: string }) {
  const canCopy = typeof navigator !== "undefined" && Boolean(navigator.clipboard);
  if (!canCopy) return null;
  return (
    <button
      type="button"
      className="toast__copy"
      onClick={() => {
        void navigator.clipboard.writeText(text);
      }}
    >
      Copy
    </button>
  );
}
