import { Route, Routes } from "react-router";
import type { ShopLiteApi } from "./api/client";
import type { PortalApi } from "./api/portal";
import { ApiProvider } from "./app/ApiContext";
import { CartProvider } from "./app/CartContext";
import { CustomerProvider } from "./app/CustomerContext";
import { PortalProvider } from "./app/PortalContext";
import { ToastProvider } from "./app/ToastContext";
import { Header } from "./components/Header";
import { Toasts } from "./components/Toasts";
import { CartPage } from "./pages/CartPage";
import { CatalogPage } from "./pages/CatalogPage";
import { CheckoutPage } from "./pages/CheckoutPage";
import { MyTicketsPage } from "./pages/MyTicketsPage";

/** The storefront. Expects to be rendered inside a router. */
export function App({ api, portal }: { api: ShopLiteApi; portal: PortalApi }) {
  return (
    <ApiProvider api={api}>
      <PortalProvider portal={portal}>
        <ToastProvider>
          <CustomerProvider>
            <CartProvider>
              <Header />
              <main className="main">
                <Routes>
                  <Route path="/" element={<CatalogPage />} />
                  <Route path="/cart" element={<CartPage />} />
                  <Route path="/checkout" element={<CheckoutPage />} />
                  <Route path="/tickets" element={<MyTicketsPage />} />
                </Routes>
              </main>
              <footer className="foot">
                <span>ShopLite is a demo store. Nothing ships, nothing is charged.</span>
              </footer>
              <Toasts />
            </CartProvider>
          </CustomerProvider>
        </ToastProvider>
      </PortalProvider>
    </ApiProvider>
  );
}
