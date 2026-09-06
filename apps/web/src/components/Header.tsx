import { Link, NavLink } from "react-router";
import { useCart } from "../app/CartContext";
import { useCustomer } from "../app/CustomerContext";
import { CartTag } from "./CartTag";

export function Header() {
  const { customers, customer, selectCustomer } = useCustomer();
  const { cart, version } = useCart();

  return (
    <header className="masthead">
      <div className="masthead__inner">
        <Link to="/" className="wordmark">
          <span className="wordmark__name">ShopLite</span>
          <span className="wordmark__line">general goods</span>
        </Link>

        <nav className="nav" aria-label="Store">
          <NavLink to="/" end>
            Shop
          </NavLink>
          <NavLink to="/cart">Cart</NavLink>
          <NavLink to="/tickets">My tickets</NavLink>
        </nav>

        <div className="masthead__right">
          <label className="picker">
            <span className="picker__label">Signed in as</span>
            <select
              className="picker__select"
              value={customer?.id ?? ""}
              onChange={(event) => selectCustomer(event.target.value)}
              disabled={customers.length === 0}
            >
              {customers.length === 0 && <option value="">Loading…</option>}
              {customers.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </select>
          </label>
          <CartTag totals={cart?.totals ?? null} version={version} />
        </div>
      </div>
    </header>
  );
}
