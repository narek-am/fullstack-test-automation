# README media generator

Creates every GIF and image in `docs/media` from the **running app and real test results**, so
the README never shows mock-ups. GIFs are encoded in plain JavaScript (`gifenc`), so no ffmpeg is
needed.

| Scene | Output | What it records |
|-------|--------|-----------------|
| `ui` | `ui-test.gif` | Playwright buying a product, with captions and a ring on each element it uses |
| `mobile` | `mobile-test.gif` | The same purchase on an emulated iPhone 14, inside a phone frame |
| `keyboard` | `keyboard-test.gif` | A keyboard-only purchase, showing the focus ring move |
| `chaos` | `chaos-test.gif` | The product service switched off and back on through the chaos middleware |
| `visual` | `visual-test.gif` | A real BackstopJS run after a deliberate CSS change (restored afterwards) |
| `security` | `security-test.gif` | Real output of the security test suite |
| `load` | `load-test.gif` | A real Apache Bench run, drawn as a chart |
| `lighthouse` | `lighthouse.png` | The score gauges of a real Lighthouse CI report |
| `ci` | `ci-pipeline.png` | The jobs of the latest successful GitHub Actions run |
| `banner` | `banner.png` | The README banner |

## Run

The app and the suites the scenes use need their dependencies installed (`app`, `visual-tests/backstop`,
`security-tests`, `performance-tests`), plus Google Chrome for BackstopJS and Lighthouse.

```bash
cd docs/media/generator && npm ci && npx playwright install chromium webkit
node generate.mjs                  # every scene
node generate.mjs ui chaos         # only some
PREVIEW_DIR=/tmp/frames node generate.mjs ui   # also save a few frames as PNG for review
```
