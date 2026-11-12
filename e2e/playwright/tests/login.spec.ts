import { test, expect } from '../support/fixtures';
import { users } from '../support/users';

test.describe('Login', () => {
  test.beforeEach(async ({ loginPage }) => {
    await loginPage.goto();
  });

  test('logs in and greets the user', async ({ page, loginPage }) => {
    await loginPage.loginAs(users.alice);
    await expect(page).toHaveURL('/');
    await expect(loginPage.greeting).toHaveText(`Hi, ${users.alice.firstName}`);
    await expect(loginPage.ordersLink).toBeVisible();
    await expect(loginPage.loginLink).toBeHidden();
  });

  test('shows an error for a wrong password and stays on the page', async ({ page, loginPage }) => {
    await loginPage.login(users.alice.email, 'wrong-password');
    await expect(loginPage.message).toHaveText('Invalid email or password');
    await expect(page).toHaveURL(/\/login/);
    await expect(loginPage.submit).toBeEnabled();
  });

  test('validates empty fields on the client', async ({ loginPage }) => {
    await loginPage.submit.click();
    await expect(loginPage.message).toHaveText('Please enter your email and password.');
  });

  test('redirects back to the page that required login', async ({ page, loginPage }) => {
    await loginPage.goto('/orders');
    await loginPage.loginAs(users.alice);
    await expect(page).toHaveURL('/orders');
  });

  test('ignores external redirect targets (no open redirect)', async ({ page, loginPage }) => {
    await page.goto('/login?next=//evil.example.com');
    await loginPage.loginAs(users.alice);
    await expect(page).toHaveURL('/');
  });

  test('logs out and clears the session', async ({ page, loginPage }) => {
    await loginPage.loginAs(users.alice);
    await loginPage.logout();
    await expect(loginPage.loginLink).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('shoplite.token'))).toBeNull();
  });
});

test('protected pages redirect anonymous users to login', async ({ page }) => {
  await page.goto('/cart');
  await expect(page).toHaveURL('/login?next=%2Fcart');
});
