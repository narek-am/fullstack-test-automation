const { expect, browser, $, $$ } = require('@wdio/globals');

// The same shop, in the browser real Android users have. Driven through Appium, so the test also
// controls the device itself: the on-screen keyboard and the screen orientation.

const alice = { email: 'alice@shoplite.test', password: 'Passw0rd!' };
const byTestId = (id) => $(`[data-testid="${id}"]`);

async function pageOverflow() {
  return browser.execute(() => document.documentElement.scrollWidth - window.innerWidth);
}

describe('ShopLite in Chrome on Android', () => {
  before(async () => {
    await browser.setOrientation('PORTRAIT');
  });

  it('shows the product list in one column with no sideways scrolling', async () => {
    await browser.url('/');
    await expect($$('[data-testid="product-card"]')).toBeElementsArrayOfSize(6);
    const lefts = await browser.execute(() =>
      [...document.querySelectorAll('[data-testid="product-card"]')].map((c) => Math.round(c.getBoundingClientRect().left)),
    );
    expect(new Set(lefts).size).toBe(1);
    expect(await pageOverflow()).toBeLessThanOrEqual(0);
  });

  it('opens the on-screen keyboard for the email field', async () => {
    await browser.url('/login');
    await byTestId('email-input').click();
    await browser.waitUntil(() => browser.isKeyboardShown(), { timeoutMsg: 'the keyboard did not open' });
    await browser.hideKeyboard();
    await browser.waitUntil(async () => !(await browser.isKeyboardShown()), { timeoutMsg: 'the keyboard did not close' });
  });

  it('lets a shopper log in, buy a product and see the order', async () => {
    await browser.url('/login');
    await byTestId('email-input').setValue(alice.email);
    await byTestId('password-input').setValue(alice.password);
    await byTestId('login-button').click();
    await expect(byTestId('nav-greeting')).toHaveText('Hi, Alice');

    await $('=Bug Hunter Mug').click();
    await expect(byTestId('product-name')).toHaveText('Bug Hunter Mug');
    await byTestId('add-to-cart').click();
    await expect(byTestId('message')).toHaveText('Added to cart.');
    await expect(byTestId('cart-count')).toHaveText('1');

    await byTestId('nav-cart').click();
    await byTestId('checkout-button').click();
    await expect(browser).toHaveUrl(expect.stringMatching(/\/orders\?placed=\d+/));
    await expect(byTestId('orders-table')).toHaveText(expect.stringContaining('Bug Hunter Mug'));
  });

  it('keeps the product page usable after rotating to landscape and back', async () => {
    await browser.url('/product?id=1');
    await expect(byTestId('product-name')).toHaveText('Testing Handbook');

    await browser.setOrientation('LANDSCAPE');
    await browser.waitUntil(async () => browser.execute(() => window.innerWidth > window.innerHeight), {
      timeoutMsg: 'the page did not switch to landscape',
    });
    expect(await pageOverflow()).toBeLessThanOrEqual(0);
    await expect(byTestId('add-to-cart')).toBeClickable();

    await browser.setOrientation('PORTRAIT');
    await browser.waitUntil(async () => browser.execute(() => window.innerHeight > window.innerWidth));
    expect(await pageOverflow()).toBeLessThanOrEqual(0);
  });
});
