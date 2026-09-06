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
import { ApiError } from "../api/client";

export type Toast = {
  id: number;
  tone: "error" | "success";
  title: string;
  detail?: string;
  /** The failed request's trace id, shown so the customer can quote it. */
  traceId?: string | null;
};

type ToastInput = Omit<Toast, "id">;

type ToastApi = {
  toasts: Toast[];
  notify(toast: ToastInput): void;
  /** Turns any thrown error into a toast. API errors keep their message and trace id. */
  showError(error: unknown, fallbackTitle?: string): void;
  dismiss(id: number): void;
};

const ToastContext = createContext<ToastApi | null>(null);

const SUCCESS_TTL_MS = 4000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
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
      setToasts((current) => [...current, { ...input, id }]);
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
    (error: unknown, fallbackTitle = "Something went wrong") => {
      if (error instanceof ApiError) {
        notify({
          tone: "error",
          title: error.message,
          detail: "We couldn't complete that. Quote the reference below if you contact support.",
          traceId: error.traceId,
        });
        return;
      }
      notify({
        tone: "error",
        title: fallbackTitle,
        detail: error instanceof Error ? error.message : "The store could not be reached.",
        traceId: null,
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
