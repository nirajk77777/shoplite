# ShopLite

A small e-commerce API built as the product that [Incident Resolver](https://github.com/nirajk77777/incident-resolver) investigates. Customers are picked from seed data, add products to a cart, apply a discount code, and check out through the HTTP API against a mock payment gateway. Fix pull requests from the agent target this repository.

Stack: TypeScript, Node 22, pnpm workspaces, Fastify, Drizzle, Postgres, vitest, Biome.

## Layout

```
apps/api/
  src/domain/      pricing, cart totals, discounts, order finalisation. Pure functions, unit tested with no database
  src/payments/    mock payment gateway
  src/carts/       cart persistence
  src/checkout/    checkout flow: price, charge, write order and payment
  src/routes/      thin Fastify handlers
  src/db/          Drizzle schema, client, migrator, seed
  drizzle/         SQL migrations
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

## Run it

Requires Node 22 (see `.nvmrc`), pnpm 10, and the incident-resolver compose stack running.

```bash
pnpm install
pnpm db:migrate        # creates the shoplite schema tables
pnpm db:seed           # five customers, eight products, three discount codes. Safe to rerun; it resets the tables
pnpm dev               # API on http://localhost:4000
```

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

## Tests

```bash
pnpm test               # unit tests: domain module and mock gateway. No database, no network
pnpm test:integration   # API tests through Fastify inject against the compose Postgres
pnpm test:all
pnpm typecheck
pnpm lint
```

Unit tests end in `.test.ts`, integration tests in `.integration.test.ts`. The unit suite is what the Incident Resolver code agent runs and extends inside a Workspace clone, so it must keep working with nothing but `pnpm install`.
