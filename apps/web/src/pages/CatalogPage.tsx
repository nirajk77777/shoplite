import { useState } from "react";
import type { Product } from "../api/client";
import { useApi } from "../app/ApiContext";
import { useCart } from "../app/CartContext";
import { useToasts } from "../app/ToastContext";
import { useLoad } from "../app/useLoad";
import { ProductImage } from "../components/ProductImage";
import { formatCents } from "../lib/money";

export function CatalogPage() {
  const api = useApi();
  const { addItem } = useCart();
  const { notify, showError } = useToasts();
  const products = useLoad(api.listProducts, "Could not load the catalog");
  const [busyIds, setBusyIds] = useState<ReadonlySet<string>>(new Set());

  async function add(product: Product) {
    setBusyIds((current) => new Set(current).add(product.id));
    try {
      await addItem(product.id);
      notify({ tone: "success", title: `${product.name} added to cart` });
    } catch (error) {
      showError(error, "Could not add to cart");
    } finally {
      setBusyIds((current) => {
        const next = new Set(current);
        next.delete(product.id);
        return next;
      });
    }
  }

  return (
    <section className="page">
      <div className="shelf-head">
        <h1 className="display">Everyday things, made to last.</h1>
        <p className="shelf-head__note">
          {products ? `${products.length} products` : "Loading the shelves…"}
        </p>
      </div>

      {products && (
        <ul className="grid">
          {products.map((product) => (
            <li key={product.id} className="card">
              <ProductImage src={product.imageUrl} name={product.name} />
              <div className="card__body">
                <h2 className="card__name">{product.name}</h2>
                <p className="card__desc">{product.description}</p>
                <div className="card__meta">
                  <span className="mono muted">{product.sku}</span>
                  <span className="mono price">{formatCents(product.priceCents)}</span>
                </div>
                <button
                  type="button"
                  className="button button--primary"
                  onClick={() => add(product)}
                  disabled={busyIds.has(product.id)}
                >
                  {busyIds.has(product.id) ? "Adding…" : "Add to cart"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
