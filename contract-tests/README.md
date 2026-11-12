# Consumer-driven contract tests (Pact)

Contract between the **shoplite-web** client (consumer) and the **shoplite-api** (provider).

```
consumer test ──▶ Pact mock server ──▶ pacts/shoplite-web-shoplite-api.json ──▶ provider verification against the real API
```

## Consumer side (`consumer/`)

- `shopliteClient.js` is the client code under test: the calls the web UI makes.
- `shopliteWeb.consumer.test.js` describes each interaction the client needs (request, provider state,
  expected response) and runs the client against the Pact mock server.
- Responses use **matchers** (`integer`, `string`, `regex`, `eachLike`...) so the contract fixes
  types and formats, not exact data. The provider can change prices or add products without
  breaking it.
- 10 interactions: product list, category filter, product details, missing product, login,
  wrong password, add to cart, get cart, cart without a token, place order.

## Provider side (`provider/`)

- Starts the real ShopLite app with a fresh database and replays every interaction from the pact file.
- **Provider states** (`stateHandlers`) prepare the data each interaction expects, for example
  "alice is logged in and has 2 mugs in her cart".
- A `requestFilter` replaces the consumer's placeholder token with a real one issued by the state handler.

If the API renames a field the client relies on (say `priceCents` → `price`), provider
verification fails and names the interaction and field, before anything reaches an environment.

## Run

```bash
npm install
npm test                # consumer tests, then provider verification
npm run test:consumer   # generate the pact file only
npm run test:provider   # verify the API against an existing pact file
```

In a larger setup the pact file would be published to a Pact Broker and the provider
pipeline would verify it, with `can-i-deploy` checks before releases.
