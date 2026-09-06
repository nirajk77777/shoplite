import { useEffect, useState } from "react";
import { useToasts } from "./ToastContext";

/**
 * Runs `load` when it changes and keeps the latest result, ignoring replies
 * from a load that has since been superseded. Pass `null` to load nothing.
 * Callers memoise `load` so it only changes when its inputs do.
 */
export function useLoad<T>(load: (() => Promise<T>) | null, failTitle: string): T | null {
  const { showError } = useToasts();
  const [data, setData] = useState<T | null>(null);

  useEffect(() => {
    setData(null);
    if (!load) return;
    let cancelled = false;
    load()
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((error: unknown) => {
        if (!cancelled) showError(error, { title: failTitle });
      });
    return () => {
      cancelled = true;
    };
  }, [load, failTitle, showError]);

  return data;
}
