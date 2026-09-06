// The one way the storefront talks to an HTTP service: JSON in, JSON out, and a failure
// turned into whatever error that service raises. Both clients here — the store's own API
// and the Incident Resolver portal — are this plus their routes.

/** Builds the error a non-2xx reply becomes. `message` is the service's own words, when it gave any. */
export type Failed = (context: {
  message: string | undefined;
  status: number;
  response: Response;
}) => Error;

export type JsonClientOptions = {
  fetchImpl?: typeof fetch;
  /** Where the service is reachable from the browser. The dev server proxies it. */
  baseUrl: string;
  failed: Failed;
};

/** One request. Throws what `failed` builds when the service refuses. */
export type Call = <T>(method: string, path: string, body?: unknown) => Promise<T>;

export function createCall({ fetchImpl = fetch, baseUrl, failed }: JsonClientOptions): Call {
  return async <T>(method: string, path: string, body?: unknown): Promise<T> => {
    const response = await fetchImpl(`${baseUrl}${path}`, {
      method,
      headers: body === undefined ? {} : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      throw failed({ message: messageOf(payload), status: response.status, response });
    }
    return payload as T;
  };
}

/**
 * What the service said was wrong. Both services answer a refusal as JSON: the store as
 * `{ error }`, the portal as `{ error, message }` where the message is the useful half.
 */
function messageOf(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object") return undefined;
  const { message, error } = payload as { message?: unknown; error?: unknown };
  if (typeof message === "string") return message;
  return typeof error === "string" ? error : undefined;
}
