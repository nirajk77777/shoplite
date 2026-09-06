import { type FormEvent, useState } from "react";
import { Link } from "react-router";
import { useCart } from "../app/CartContext";
import { useToasts } from "../app/ToastContext";
import { LineList } from "../components/LineList";
import { Receipt } from "../components/Receipt";

export function CartPage() {
  const { cart, removeItem, applyDiscount, clearDiscount } = useCart();
  const { notify, showError } = useToasts();
  const [code, setCode] = useState("");
  // Product ids being removed, plus the "code" and "clear" buttons.
  const [busy, setBusy] = useState<ReadonlySet<string>>(new Set());

  if (!cart) {
    return (
      <section className="page">
        <p className="muted">Loading your cart…</p>
      </section>
    );
  }

  async function run(key: string, work: () => Promise<void>, failTitle: string) {
    setBusy((current) => new Set(current).add(key));
    try {
      await work();
    } catch (error) {
      showError(error, failTitle);
    } finally {
      setBusy((current) => {
        const next = new Set(current);
        next.delete(key);
        return next;
      });
    }
  }

  function submitCode(event: FormEvent) {
    event.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) return;
    void run(
      "code",
      async () => {
        await applyDiscount(trimmed);
        setCode("");
        notify({ tone: "success", title: `Code ${trimmed.toUpperCase()} applied` });
      },
      "Could not apply code",
    );
  }

  return (
    <section className="page">
      <h1 className="display">Your cart</h1>

      {cart.items.length === 0 ? (
        <div className="empty">
          <p>Nothing in here yet.</p>
          <Link to="/" className="button button--primary">
            Browse the shop
          </Link>
        </div>
      ) : (
        <div className="split">
          <LineList
            items={cart.items}
            busyIds={busy}
            onRemove={(productId) =>
              run(productId, () => removeItem(productId), "Could not remove item")
            }
          />

          <aside className="summary">
            <form className="code" onSubmit={submitCode}>
              <label className="code__label" htmlFor="discount-code">
                Discount code
              </label>
              <div className="code__row">
                <input
                  id="discount-code"
                  className="input mono"
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  placeholder="SALE10"
                  autoComplete="off"
                />
                <button
                  type="submit"
                  className="button"
                  disabled={busy.has("code") || !code.trim()}
                >
                  Apply
                </button>
              </div>
              {cart.discountCode && (
                <p className="code__applied">
                  <span className="mono">{cart.discountCode}</span> is on this cart.{" "}
                  <button
                    type="button"
                    className="link-button"
                    disabled={busy.has("clear")}
                    onClick={() => run("clear", clearDiscount, "Could not remove code")}
                  >
                    Remove code
                  </button>
                </p>
              )}
            </form>

            <Receipt
              totals={cart.totals}
              discountCode={cart.discountCode}
              footer={
                <Link to="/checkout" className="button button--primary button--wide">
                  Go to checkout
                </Link>
              }
            />
          </aside>
        </div>
      )}
    </section>
  );
}
