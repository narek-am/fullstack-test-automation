# Exploratory Testing: ShopLite

Automated checks confirm what we already expect. Exploratory sessions look for what we
did **not** expect. Each session is time-boxed, has a charter (a mission), and ends with
short notes: what was covered, what was found and what to explore next.

Charter format: **Explore** _target_ **with** _resources_ **to discover** _information_.

## Charters

### C1: Product search
**Explore** the product search and filters **with** unusual input (empty strings, very long
strings, SQL/HTML special characters, Unicode, leading/trailing spaces) **to discover**
crashes, wrong results or unescaped output.

Ideas: `%`, `_`, `'`, `<b>`, emoji, 101 characters, category + search combined,
sort parameter edited in the URL, back button after filtering.

### C2: Cart quantity edge cases
**Explore** the cart **with** boundary quantities (0, 1, stock, stock + 1, 99, 100, negative,
decimals) **to discover** wrong totals or stock that can be exceeded.

Ideas: add the same item from two tabs, change quantity to more than stock, remove the last
item, cart total exactly at the free-shipping threshold.

### C3: Checkout under changing stock
**Explore** checkout **with** two users and an admin changing stock in between
**to discover** overselling or partially saved orders.

### C4: Session handling
**Explore** login and logout **with** several tabs, expired tokens and edited localStorage
**to discover** pages that show stale or someone else's data.

### C5: API directly
**Explore** the REST API **with** Postman and DevTools (edit and replay requests)
**to discover** endpoints that trust the client too much.

Ideas: change IDs in `/api/orders/:id`, send extra JSON fields, wrong content types,
huge bodies, missing `Authorization` header, HTTP verbs that are not documented.

### C6: Accessibility and mobile
**Explore** the main flow **with** keyboard only, a screen reader (VoiceOver/NVDA),
200% zoom and a 375 px wide viewport **to discover** blockers for real users.

## Heuristics used

- **Boundaries:** min, max, just inside, just outside.
- **CRUD:** create, read, update, delete every entity and look at the side effects.
- **Interruptions:** refresh, back button, two tabs, network offline in DevTools.
- **Follow the data:** where is a value entered, stored, shown, and can it change on the way?
- **Personas:** a first-time shopper, an impatient power user, a malicious user.

## Session notes template

Copy this table into a new file under `docs/sessions/` for each session.

| | |
|---|---|
| **Charter** | _e.g. C2: cart quantity edge cases_ |
| **Date / duration** | _e.g. 45 minutes_ |
| **Build** | _commit hash, browser and version_ |
| **Covered** | _areas and ideas actually tried_ |
| **Bugs found** | _short description + link to the issue_ |
| **Questions** | _open questions for the team_ |
| **Next** | _what to explore in a follow-up session_ |

## Test environment hygiene

- Start every session from a fresh database (`DB_PATH` pointing to a new file).
- Write down the commit hash and browser version in the notes.
- Never explore against production data. Use the seeded demo accounts.
