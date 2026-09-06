import { createContext, type ReactNode, useContext } from "react";
import type { PortalApi } from "../api/portal";

const PortalContext = createContext<PortalApi | null>(null);

export function PortalProvider({ portal, children }: { portal: PortalApi; children: ReactNode }) {
  return <PortalContext.Provider value={portal}>{children}</PortalContext.Provider>;
}

export function usePortal(): PortalApi {
  const portal = useContext(PortalContext);
  if (!portal) throw new Error("usePortal must be used inside PortalProvider");
  return portal;
}
