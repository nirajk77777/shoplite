import { useToasts } from "../app/ToastContext";

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
