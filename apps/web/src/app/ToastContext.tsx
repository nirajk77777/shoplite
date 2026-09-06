import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useLocation } from "react-router";
import { ApiError } from "../api/client";

export type Toast = {
  id: number;
  tone: "error" | "success";
  title: string;
  detail?: string;
  /** The failed request's trace id, shown so the customer can quote it. */
  traceId?: string | null;
  /** What the customer was doing, in their own words, when the page knows it. */
  doing?: string | undefined;
  /** Where in the store they were. Read off the router, not passed in. */
  page: string;
};

type ToastInput = Omit<Toast, "id" | "page">;

/** What the page can say about a failure beyond the error itself. */
export type ErrorContext = {
  /** Shown when the error is not the API's own, which carries its message already. */
  title?: string;
  /** What the customer was doing: it becomes the first line of a reported Ticket. */
  doing?: string;
};

type ToastApi = {
  toasts: Toast[];
  notify(toast: ToastInput): void;
  /** Turns any thrown error into a toast. API errors keep their message and trace id. */
  showError(error: unknown, about?: ErrorContext): void;
  dismiss(id: number): void;
};

const ToastContext = createContext<ToastApi | null>(null);

const SUCCESS_TTL_MS = 4000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  // Where the customer was when it happened, stamped as the toast is raised rather than read
  // when it is reported: by then they may have navigated away from the page that failed. Held
  // in a ref so that navigating does not give `notify` and `showError` new identities, which
  // would re-run every effect that loads through them.
  const { pathname } = useLocation();
  const page = useRef(pathname);
  page.current = pathname;
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());

  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const timer of pending) clearTimeout(timer);
    };
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const notify = useCallback(
    (input: ToastInput) => {
      const id = Date.now() + Math.random();
      setToasts((current) => [...current, { ...input, id, page: page.current }]);
      // Errors stay until dismissed: a tester needs time to copy the reference.
      if (input.tone === "success") {
        const timer = setTimeout(() => {
          timers.current.delete(timer);
          dismiss(id);
        }, SUCCESS_TTL_MS);
        timers.current.add(timer);
      }
    },
    [dismiss],
  );

  const showError = useCallback(
    (error: unknown, about: ErrorContext = {}) => {
      if (error instanceof ApiError) {
        notify({
          tone: "error",
          title: error.message,
          detail: "We couldn't complete that. Quote the reference below if you contact support.",
          traceId: error.traceId,
          doing: about.doing,
        });
        return;
      }
      notify({
        tone: "error",
        title: about.title ?? "Something went wrong",
        detail: error instanceof Error ? error.message : "The store could not be reached.",
        traceId: null,
        doing: about.doing,
      });
    },
    [notify],
  );

  const value = useMemo(
    () => ({ toasts, notify, showError, dismiss }),
    [toasts, notify, showError, dismiss],
  );

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}

export function useToasts(): ToastApi {
  const toasts = useContext(ToastContext);
  if (!toasts) throw new Error("useToasts must be used inside ToastProvider");
  return toasts;
}
