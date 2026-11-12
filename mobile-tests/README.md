# Mobile tests

ShopLite is a mobile web shop as well as a desktop one, so it is tested on phones in two ways:

| Layer | Tool | Where | What it gives |
|-------|------|-------|---------------|
| Phone emulation | Playwright (Pixel 7 in Chromium, iPhone 14 in WebKit) | `e2e/playwright/mobile/` | Fast, runs on every push; real viewports, touch, mobile user agents |
| Real mobile browser | Appium 3 + WebdriverIO, UiAutomator2 driver | `mobile-tests/` | The actual Chrome for Android, its on-screen keyboard and screen rotation |

Emulation catches layout and touch problems quickly. Appium covers what only a real device or
emulator has: the mobile browser itself, the system keyboard and orientation changes.

## Phone emulation (Playwright)

```bash
cd e2e/playwright && npx playwright test --project=mobile-android --project=mobile-ios
```

- every page fits the screen with no sideways scrolling;
- tap targets are at least 24 x 24 px (WCAG 2.5.8);
- products are shown in one column, and pinch zoom is not disabled;
- a full purchase using taps only;
- inputs bring up the right keyboard (`type="email"`, `type="search"`, `inputmode="numeric"`);
- the product page fits and works in landscape.

**Found and fixed:**
- **Small tap targets:** the header links were 18 px tall and the product names 20 px. They now
  get extra padding on touch screens only (`@media (pointer: coarse)`), so desktop layouts and
  screenshots are unchanged.
- **Wrong keyboard for quantities:** quantity fields had no `inputmode`, so iPhones showed the full
  keyboard instead of the number pad.

## Appium on Android (`mobile-tests/`)

`appium` and `appium-uiautomator2-driver` are project dependencies, so Appium needs no global
install; `@wdio/appium-service` starts it for the test run. The tests open ShopLite in Chrome on
the emulator and check:

- the product list is a single column with no sideways scrolling;
- tapping the email field opens the on-screen keyboard, and it can be closed again;
- a full purchase: log in, open a product, add to cart, check out, see the order;
- the product page still fits and works after rotating to landscape and back.

### Run locally

Needs the Android SDK with an emulator (Android Studio is the easiest way to get one):

```bash
emulator -avd <your-avd> &              # or start one from Android Studio
cd app && npm ci && cd ../mobile-tests && npm ci
npm run start:app                         # ShopLite on port 3701; the emulator sees it as 10.0.2.2
npm test                                  # in a second terminal
```

The chromedriver matching the emulator's Chrome is downloaded automatically
(`appium:chromedriverAutodownload`, allowed with `--allow-insecure uiautomator2:chromedriver_autodownload`).

### In CI

Job `mobile-appium` boots an Android 14 (API 34, `google_apis`, x86_64) emulator with KVM on the
Linux runner using [android-emulator-runner](https://github.com/ReactiveCircus/android-emulator-runner),
starts ShopLite on the runner and runs the suite. A passing run lists the tests as a notice on
the run page; a failing run posts the last error lines from the WebdriverIO and Appium logs as an
annotation. The logs are also uploaded as an artifact.

Getting it running in CI took three fixes, each found from those annotations:
1. Appium refused to start: the config passed `--log-file`, but Appium's option for a log file is
   `--log`.
2. WebdriverIO 9 wraps Linux workers in `xvfb-run` by default; the worker never started.
   A virtual display isn't needed when the browser runs on the device, so `autoXvfb` is off.
3. The failure annotation first showed only error-looking lines; it now includes the last lines of
   each log, which is how fix 2 was found.
