import type { CartItem } from "../api/client";
import { formatCents } from "../lib/money";

type LineListProps = {
  items: CartItem[];
  /** When given, each line gets a Remove button. */
  onRemove?: (productId: string) => void;
  /** Product ids whose request is in flight. */
  busyIds?: ReadonlySet<string>;
  compact?: boolean;
};

/** The cart's lines: name, SKU, quantity times unit price, line total. */
export function LineList({ items, onRemove, busyIds, compact = false }: LineListProps) {
  return (
    <ul className={`lines${compact ? " lines--compact" : ""}`}>
      {items.map((item) => (
        <li key={item.productId} className="line">
          <div className="line__main">
            <span className="line__name">{item.name}</span>
            <span className="mono muted">
              {compact ? "" : `${item.sku} · `}
              {item.quantity} × {formatCents(item.unitPriceCents)}
            </span>
          </div>
          <span className="mono price">{formatCents(item.lineTotalCents)}</span>
          {onRemove && (
            <button
              type="button"
              className="button button--quiet"
              disabled={busyIds?.has(item.productId)}
              onClick={() => onRemove(item.productId)}
            >
              Remove
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
