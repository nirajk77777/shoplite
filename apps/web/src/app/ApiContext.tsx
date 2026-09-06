import { createContext, type ReactNode, useContext } from "react";
import type { ShopLiteApi } from "../api/client";

const ApiContext = createContext<ShopLiteApi | null>(null);

export function ApiProvider({ api, children }: { api: ShopLiteApi; children: ReactNode }) {
  return <ApiContext.Provider value={api}>{children}</ApiContext.Provider>;
}

export function useApi(): ShopLiteApi {
  const api = useContext(ApiContext);
  if (!api) throw new Error("useApi must be used inside ApiProvider");
  return api;
}
