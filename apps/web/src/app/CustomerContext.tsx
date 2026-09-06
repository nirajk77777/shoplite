import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from "react";
import type { Customer } from "../api/client";
import { useApi } from "./ApiContext";
import { useLoad } from "./useLoad";

/**
 * There is no authentication. The person at the keyboard picks which seeded
 * customer they are signed in as, and the choice sticks across reloads.
 */
type CustomerState = {
  customers: Customer[];
  customer: Customer | null;
  selectCustomer(id: string): void;
};

const STORAGE_KEY = "shoplite.customerId";

const CustomerContext = createContext<CustomerState | null>(null);

function readStoredId(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function storeId(id: string): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // Private mode or blocked storage: the picker still works for this page load.
  }
}

export function CustomerProvider({ children }: { children: ReactNode }) {
  const api = useApi();
  const customers = useLoad(api.listCustomers, "Could not load customers") ?? [];
  const [selectedId, setSelectedId] = useState<string | null>(readStoredId);

  const selectCustomer = useCallback((id: string) => {
    setSelectedId(id);
    storeId(id);
  }, []);

  const value = useMemo<CustomerState>(
    () => ({
      customers,
      // A remembered id that is no longer seeded falls back to the first customer.
      customer: customers.find((candidate) => candidate.id === selectedId) ?? customers[0] ?? null,
      selectCustomer,
    }),
    [customers, selectedId, selectCustomer],
  );

  return <CustomerContext.Provider value={value}>{children}</CustomerContext.Provider>;
}

export function useCustomer(): CustomerState {
  const state = useContext(CustomerContext);
  if (!state) throw new Error("useCustomer must be used inside CustomerProvider");
  return state;
}
