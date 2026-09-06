# ShopLite

A small e-commerce store built as the product that [Incident Resolver](https://github.com/nirajk77777/incident-resolver) investigates. Customers are picked from seed data, add products to a cart, apply a discount code, and check out against a mock payment gateway, through the HTTP API or the storefront. Fix pull requests from the agent target this repository.

Stack: TypeScript, Node 22, pnpm workspaces, Fastify, Drizzle, Postgres, OpenTelemetry, React, Vite, vitest, Biome.

## Layout

```
apps/api/
  src/domain/      pricing, cart totals, discounts, order finalisation. Pure functions, unit tested with no database
  src/payments/    mock payment gateway
  src/carts/       cart persistence
  src/checkout/    checkout flow: price, charge, write order and payment
  src/routes/      thin Fastify handlers
  src/db/          Drizzle schema, client, migrator, seed
  src/telemetry/   OpenTelemetry SDK setup (loaded with --import) and business metric counters
  drizzle/         SQL migrations
apps/web/
  src/api/         one JSON caller and the two clients over it: the store's own API, whose failures
                   become an ApiError carrying the trace id, and the Incident Resolver portal
  src/app/         providers: API, portal, signed-in customer, cart, toasts; the useLoad hook
  src/components/  header with the cart tag, line list, receipt, toasts, product image
  src/pages/       catalog, cart, checkout, my tickets
  src/lib/         money and item-count formatting; Tickets in the customer's words
  src/test/        vitest setup for the jsdom project
  public/images/   product illustrations the seed's imageUrl values point at
```

## Environment

ShopLite has no compose file. It connects to the Postgres and the OTLP collector started by the incident-resolver repository's `docker compose up`, and reads both from the environment. Copy `.env.example` to `.env` to override.

| Variable | Default | Purpose |
|----------|---------|---------|
| `DATABASE_URL` | `postgres://postgres:postgres@localhost:5432/incident_resolver` | Postgres connection string. ShopLite owns the `shoplite` schema inside it. |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | `http://localhost:4318` | OTLP HTTP endpoint for traces, metrics, and logs. |
| `PORT` | `4000` | API port. |
| `HOST` | `0.0.0.0` | API bind address. |
| `LOG_LEVEL` | `info` | pino level: `fatal`, `error`, `warn`, `info`, `debug`, `trace`. |
| `OTEL_SERVICE_NAME` | `shoplite-api` | Service name on every trace, metric, and log. |
| `WEB_PORT` | `4001` | Storefront dev server port. |
| `SHOPLITE_API_URL` | `http://localhost:4000` | Where the storefront dev server forwards `/api/*` requests. |
| `PORTAL_API_URL` | `http://localhost:5000` | Where the storefront dev server forwards `/portal/*` requests: the Incident Resolver portal API. |

The standard `OTEL_*` variables also apply, for example `OTEL_RESOURCE_ATTRIBUTES`, `OTEL_BSP_SCHEDULE_DELAY`, `OTEL_BLRP_SCHEDULE_DELAY`, and `OTEL_METRIC_EXPORT_INTERVAL`.

## Run it

Requires Node 22 (see `.nvmrc`), pnpm 10, and the incident-resolver compose stack running.

```bash
pnpm install
pnpm db:migrate        # creates the shoplite schema tables
pnpm db:seed           # five customers, eight products, three discount codes. Safe to rerun; it resets the tables
pnpm dev               # API on http://localhost:4000, storefront on http://localhost:4001
```

## Storefront

`apps/web` is a Vite and React app on port 4001 with four pages: the catalog, the cart, checkout, and "My tickets". There is no authentication: a "Signed in as" picker in the header chooses one of the seeded customers, and the choice is remembered in the browser.

The browser calls `/api/...` and the dev server proxies that to the API, so the `x-trace-id` response header arrives unchanged and the API needs no CORS. `/portal/...` is proxied the same way to the Incident Resolver portal API (`PORTAL_API_URL`, 5000 by default), which is the only other service the storefront talks to.

Two things are deliberate:

- The cart tag in the header shows the count and total the API reads from the `cart_totals` row. It never sums the lines, so when that row goes stale after removing an item, the tag shows the wrong number while the cart page shows the right lines. That is how a tester notices the stale total bug.
- A failed checkout shows a toast with the API's own message (`Checkout failed`, nothing about the card) and the trace id from the response header as a reference the customer can quote. Paste it into Tempo or Loki as described under Telemetry to see the request.

### Reporting a problem

Every error toast carries a **Report a problem** button. Pressing it opens a customer Ticket in the portal with the signed-in customer's email, the trace id of the request that failed, and what they were doing in their own words — "I was paying for my cart on the checkout page when the store showed \"Checkout failed\"." — so nothing has to be retyped and the agent can jump straight to the trace. The toast then becomes the confirmation, with a link to My tickets.

**My tickets** (`/tickets`) lists that customer's Tickets, how far along each one is, and the Reply once the agent has written it. It re-reads the portal every few seconds while anything is still open and stops once everything has closed. Delivery of the Reply is this page: the portal's email step is a stub that logs.

The whole loop needs the portal running (`pnpm portal` in the incident-resolver repository). Without it the button says support could not be reached, inside the toast, and My tickets says the same on the page while it keeps trying; the rest of the store is unaffected.

Both `/api` and `/portal` are dev-server proxies, so `pnpm dev` is what the storefront is built to run under. A `pnpm preview` build has neither proxy, and neither service sends CORS headers, so a previewed build reaches nothing.

## Checkout with curl

Customer and product ids are fixed in the seed, so these commands work verbatim.

```bash
API=http://localhost:4000
AVA=00000000-0000-4000-8000-000000000001
MUG=00000000-0000-4000-9000-000000000001
POSTER=00000000-0000-4000-9000-000000000002

curl -s $API/products | jq '.[] | {id, sku, priceCents}'
curl -s -X POST $API/customers/$AVA/cart/items -H 'content-type: application/json' -d "{\"productId\":\"$MUG\",\"quantity\":2}"
curl -s -X POST $API/customers/$AVA/cart/items -H 'content-type: application/json' -d "{\"productId\":\"$POSTER\"}"
curl -s -X POST $API/customers/$AVA/cart/discount -H 'content-type: application/json' -d '{"code":"SALE10"}' | jq .totals
curl -s -X POST $API/customers/$AVA/checkout -H 'content-type: application/json' \
  -d '{"card":{"number":"4242424242424242","expMonth":12,"expYear":2030}}' | jq .order
curl -s $API/customers/$AVA/orders | jq .
```

Test cards: any well-formed number is approved; a number ending in `0002` (for example `4000000000000002`) is declined. The client sees `402 {"error":"Checkout failed"}`; the decline reason is on the `payments` row and in the API log.

## Routes

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/health` | Liveness |
| GET | `/customers` | Seeded customers, for a "signed in as" picker. No authentication |
| GET | `/products` | Catalog |
| GET | `/customers/:customerId/cart` | The open cart: items, discount code, and totals |
| POST | `/customers/:customerId/cart/items` | `{productId, quantity?}` adds or tops up a line |
| DELETE | `/customers/:customerId/cart/items/:productId` | Removes a line |
| POST | `/customers/:customerId/cart/discount` | `{code}` attaches an active discount code |
| DELETE | `/customers/:customerId/cart/discount` | Detaches the code |
| POST | `/customers/:customerId/checkout` | `{card: {number, expMonth, expYear}}` charges the cart. `201` with the order, `402` on decline, `400` on an empty cart |
| GET | `/customers/:customerId/orders` | The customer's orders, newest first |

Discount codes in the seed: `SALE10` (10% off), `FLAT5` ($5 off orders of $20 or more), `EXPIRED20` (inactive, rejected).

## Telemetry

`pnpm dev` and `pnpm start` load `apps/api/src/telemetry/instrumentation.ts` through `tsx --import` before the application, so the OpenTelemetry module hook is in place when Fastify, `pg`, and pino are imported. Everything is exported over OTLP HTTP to `OTEL_EXPORTER_OTLP_ENDPOINT`, where the LGTM collector fans it out:

| Signal | How | Where it lands |
|--------|-----|----------------|
| Traces | `@opentelemetry/instrumentation-http`, `@fastify/otel` (route spans, `http.route`), `instrumentation-pg`, `instrumentation-undici` | Tempo. `GET :3200/api/traces/<traceId>` |
| Logs | pino lines bridged through the OTel logs API by `instrumentation-pino`, which also stamps `trace_id` and `span_id` on each line | Loki. `{service_name="shoplite-api"} \| trace_id="<traceId>"` |
| Metrics | `http.server.request.duration` histogram (stable HTTP semantic conventions) plus the counters below | Prometheus, via its OTLP receiver, with `job="shoplite-api"` |

Every response carries `x-trace-id`. Paste it into Tempo or the Loki query above to see the exact request.

Business counters, defined in `src/telemetry/metrics.ts`:

| Counter | Labels | Incremented when |
|---------|--------|------------------|
| `checkout_total` | | a checkout request reaches the checkout flow |
| `checkout_errors_total` | `reason` = `declined`, `empty_cart`, `error` | a checkout does not produce an order (`error` is a thrown exception, so a 500) |
| `discount_applied_total` | `code` | a discount code is attached to a cart |

A declined card therefore shows up three ways: a trace whose server span is `POST /customers/:customerId/checkout` with status 402, a warn log line `payment declined by gateway: insufficient_funds` with the same trace id and `declineCode` as a field, and `checkout_errors_total{reason="declined"}` going up. The incident-resolver repository provisions a Grafana dashboard for all of this at `http://localhost:3000/d/shoplite`.

## Tests

```bash
pnpm test               # unit tests: domain module, mock gateway, and the storefront in jsdom. No database, no network
pnpm test:integration   # API tests through Fastify inject against the compose Postgres, and a telemetry
                        # test that starts the instrumented server and looks for one declined checkout
                        # in Tempo, Loki, and Prometheus
pnpm test:all
pnpm typecheck
pnpm lint
```

Unit tests end in `.test.ts` (or `.test.tsx` for the storefront, which run in jsdom), integration tests in `.integration.test.ts`. The unit suite is what the Incident Resolver code agent runs and extends inside a Workspace clone, so it must keep working with nothing but `pnpm install`.
