# Visual regression tests (BackstopJS)

BackstopJS takes screenshots of ShopLite pages and compares them pixel by pixel with approved
**reference images** in `backstop_data/bitmaps_reference/`. Any difference above the threshold
fails the run, and the HTML report shows reference, test and diff images side by side.

## Scenarios

11 scenarios × 3 viewports (phone 375, tablet 768, desktop 1280), 29 screenshots in total:

- Product list, empty search result, hover state on a product link
- Product details, sold-out product
- Login, client-side validation error, keyboard focus state
- Cart with items, empty cart (logged in through the API with a known cart)
- 404 page

## Making screenshots stable

| Problem | Solution |
|---------|----------|
| Data changes between runs | Fresh database per run; cart is reset through the API before the screenshot (`engine_scripts/puppet/onBefore.js`) |
| Animations, transitions, blinking caret | Disabled with an injected stylesheet (`onReady.js`; CSP is bypassed only in the test browser) |
| Web fonts still loading | Waits for `document.fonts.ready` |
| Parallel captures changing the same cart | `asyncCaptureLimit: 1` |
| Different browser builds | Uses the installed Google Chrome (`CHROME_PATH` to override) |
| OS font rendering | Reference images are made on macOS; CI runs this job on a macOS runner |
| Anti-aliasing noise | `misMatchThreshold: 0.1` (% of pixels) |

## What it found

While making the first baselines, the phone screenshot of the cart showed the table wider than the
screen, so the whole page scrolled sideways. That was fixed in the app (see the commit
"Fix cart and order tables overflowing on phones") before the baselines were approved.

A regression check: adding 2 px of horizontal padding to buttons made 7 of 29 screenshots fail
(0.11%-1.69% of pixels changed). Some desktop screens changed by less than the 0.1% threshold
and passed, which is the trade-off of a tolerance.

## Run

```bash
npm install
npm test          # start ShopLite with a fresh DB, compare with the references
npm run reference # re-create all reference images (after an intended UI change)
npm run backstop:approve   # or: approve the latest test screenshots as the new references
```

Report: `backstop_data/html_report/index.html`.
