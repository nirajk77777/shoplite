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
import type { Card, Cart, Order } from "../api/client";
import { useApi } from "./ApiContext";
import { useCustomer } from "./CustomerContext";
import { useToasts } from "./ToastContext";

/**
 * The signed-in customer's open cart, exactly as the API reports it. Every
 * mutation replaces the whole cart with the API's reply, so the header badge
 * shows whatever the cart_totals row says.
 */
type CartState = {
  cart: Cart | null;
  /** Bumped on every cart change so the header tag can react. */
  version: number;
  addItem(productId: string, quantity?: number): Promise<void>;
  removeItem(productId: string): Promise<void>;
  applyDiscount(code: string): Promise<void>;
  clearDiscount(): Promise<void>;
  checkout(card: Card): Promise<Order>;
};

const CartContext = createContext<CartState | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const api = useApi();
  const { customer } = useCustomer();
  const { showError } = useToasts();
  const [cart, setCart] = useState<Cart | null>(null);
  const [version, setVersion] = useState(0);
  const customerId = customer?.id ?? null;

  // Replies for a customer who is no longer signed in are dropped, so switching
  // the picker mid-request never shows one customer's cart under another's name.
  const currentCustomerId = useRef(customerId);
  currentCustomerId.current = customerId;

  const replace = useCallback((forCustomerId: string, next: Cart) => {
    if (currentCustomerId.current !== forCustomerId) return;
    setCart(next);
    setVersion((current) => current + 1);
  }, []);

  useEffect(() => {
    setCart(null);
    if (!customerId) return;
    api
      .getCart(customerId)
      .then((next) => replace(customerId, next))
      .catch((error: unknown) => {
        if (currentCustomerId.current === customerId) {
          showError(error, { title: "Could not load your cart", doing: "opening my cart" });
        }
      });
  }, [api, customerId, replace, showError]);

  const value = useMemo<CartState>(() => {
    const requireCustomer = () => {
      if (!customerId) throw new Error("Pick who you are signed in as first");
      return customerId;
    };
    return {
      cart,
      version,
      addItem: async (productId, quantity = 1) => {
        const id = requireCustomer();
        replace(id, await api.addItem(id, productId, quantity));
      },
      removeItem: async (productId) => {
        const id = requireCustomer();
        replace(id, await api.removeItem(id, productId));
      },
      applyDiscount: async (code) => {
        const id = requireCustomer();
        replace(id, await api.applyDiscount(id, code));
      },
      clearDiscount: async () => {
        const id = requireCustomer();
        replace(id, await api.clearDiscount(id));
      },
      checkout: async (card) => {
        const id = requireCustomer();
        const order = await api.checkout(id, card);
        replace(id, await api.getCart(id));
        return order;
      },
    };
  }, [api, cart, version, customerId, replace]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartState {
  const state = useContext(CartContext);
  if (!state) throw new Error("useCart must be used inside CartProvider");
  return state;
}
