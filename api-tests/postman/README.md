# Postman / Newman API tests

Two Postman collections for the ShopLite REST API:

| Collection | What it checks |
|------------|----------------|
| `shoplite.postman_collection.json` | Health, products (JSON schema, search, filter, sort, errors), auth, cart and order flow, access control between users. Collection-level tests check response time and security headers on every request. |
| `login-data-driven.postman_collection.json` | One login request run once per row of `data/login-cases.csv` (valid, invalid, missing fields, injection attempt). |

Requests pass data to each other through collection variables (token → cart → order ID),
the same way you would chain them when exploring the API manually in Postman.

## Run

```bash
npm install
npm test          # starts ShopLite with a fresh DB, runs both collections, stops it
```

Reports: `reports/*.html` (htmlextra) and `reports/*-junit.xml` (for CI).

Against an already running instance:

```bash
BASE_URL=http://localhost:3000 npm run test:remote
```

You can also import the collection and `local.postman_environment.json` into the Postman app.
