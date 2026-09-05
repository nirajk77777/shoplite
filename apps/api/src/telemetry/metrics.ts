import { metrics } from "@opentelemetry/api";

/**
 * Business counters. They go through the OpenTelemetry API, so they are no-ops
 * until the SDK in ./instrumentation.ts is started, which is how the unit
 * tests run.
 */
const meter = metrics.getMeter("shoplite-api");

/** Every checkout request that reached the checkout flow. */
export const checkoutAttempts = meter.createCounter("checkout_total", {
  description: "Checkout attempts",
});

/**
 * Why a checkout produced no order: the gateway declined the card, the cart was
 * empty, or the flow threw. The dashboard's "Failed checkouts by reason" legend
 * and the README list the same three values.
 */
export type CheckoutErrorReason = "declined" | "empty_cart" | "error";

const checkoutErrors = meter.createCounter("checkout_errors_total", {
  description: "Checkouts that did not produce an order, by reason",
});

export function recordCheckoutError(reason: CheckoutErrorReason): void {
  checkoutErrors.add(1, { reason });
}

/** Discount codes attached to a cart, labelled by `code`. */
export const discountApplications = meter.createCounter("discount_applied_total", {
  description: "Discount codes applied to carts",
});
