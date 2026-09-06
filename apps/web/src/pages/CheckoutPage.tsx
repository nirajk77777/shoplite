import { type FormEvent, useState } from "react";
import { Link } from "react-router";
import type { Card, Order } from "../api/client";
import { useCart } from "../app/CartContext";
import { useToasts } from "../app/ToastContext";
import { LineList } from "../components/LineList";
import { Receipt } from "../components/Receipt";
import { countItems, pluralItems } from "../lib/items";
import { formatCents } from "../lib/money";

const thisYear = new Date().getFullYear();
const years = Array.from({ length: 10 }, (_, offset) => thisYear + offset);
const months = Array.from({ length: 12 }, (_, index) => index + 1);

export function CheckoutPage() {
  const { cart, checkout } = useCart();
  const { showError } = useToasts();
  const [card, setCard] = useState<Card>({ number: "", expMonth: 12, expYear: thisYear + 3 });
  const [paying, setPaying] = useState(false);
  const [placed, setPlaced] = useState<Order | null>(null);

  if (placed) return <OrderPlaced order={placed} />;

  if (!cart) {
    return (
      <section className="page">
        <p className="muted">Loading your cart…</p>
      </section>
    );
  }

  if (cart.items.length === 0) {
    return (
      <section className="page">
        <h1 className="display">Checkout</h1>
        <div className="empty">
          <p>Nothing to pay for yet.</p>
          <Link to="/" className="button button--primary">
            Browse the shop
          </Link>
        </div>
      </section>
    );
  }

  async function pay(event: FormEvent) {
    event.preventDefault();
    setPaying(true);
    try {
      setPlaced(await checkout({ ...card, number: card.number.trim() }));
    } catch (error) {
      showError(error, "Checkout failed");
    } finally {
      setPaying(false);
    }
  }

  return (
    <section className="page">
      <h1 className="display">Checkout</h1>
      <div className="split split--checkout">
        <form className="pay" onSubmit={pay}>
          <fieldset className="pay__fields" disabled={paying}>
            <legend className="pay__legend">Card</legend>
            <label className="field">
              <span className="field__label">Card number</span>
              <input
                className="input mono"
                value={card.number}
                onChange={(event) => setCard({ ...card, number: event.target.value })}
                inputMode="numeric"
                autoComplete="cc-number"
                placeholder="4242 4242 4242 4242"
                required
              />
            </label>
            <div className="field-row">
              <label className="field">
                <span className="field__label">Month</span>
                <select
                  className="input mono"
                  value={card.expMonth}
                  onChange={(event) => setCard({ ...card, expMonth: Number(event.target.value) })}
                  autoComplete="cc-exp-month"
                >
                  {months.map((month) => (
                    <option key={month} value={month}>
                      {String(month).padStart(2, "0")}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span className="field__label">Year</span>
                <select
                  className="input mono"
                  value={card.expYear}
                  onChange={(event) => setCard({ ...card, expYear: Number(event.target.value) })}
                  autoComplete="cc-exp-year"
                >
                  {years.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </fieldset>
          <button type="submit" className="button button--primary button--wide" disabled={paying}>
            {paying ? "Paying…" : `Pay ${formatCents(cart.totals.totalCents)}`}
          </button>
        </form>

        <aside className="summary">
          <LineList items={cart.items} compact />
          <Receipt totals={cart.totals} discountCode={cart.discountCode} />
        </aside>
      </div>
    </section>
  );
}

function OrderPlaced({ order }: { order: Order }) {
  return (
    <section className="page">
      <div className="placed">
        <p className="placed__eyebrow mono">Order {order.id.slice(0, 8)}</p>
        <h1 className="display">Paid. Thank you.</h1>
        <p>
          {pluralItems(countItems(order.lines))} for{" "}
          <span className="mono">{formatCents(order.totalCents)}</span>
          {order.discountCode ? (
            <>
              , with <span className="mono">{order.discountCode}</span> applied
            </>
          ) : null}
          .
        </p>
        <div className="placed__actions">
          <Link to="/" className="button button--primary">
            Keep shopping
          </Link>
        </div>
      </div>
    </section>
  );
}
