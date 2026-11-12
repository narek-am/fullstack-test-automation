// Runs before each page loads. For scenarios with `loginAs`, logs in through the API,
// puts the cart into a known state and stores the session where the frontend expects it.
module.exports = async (page, scenario) => {
  // Lets onReady inject a stylesheet that freezes animations despite the app's strict CSP.
  await page.setBypassCSP(true);

  if (!scenario.loginAs) return;
  const base = new URL(scenario.url).origin;
  const json = { 'Content-Type': 'application/json' };

  const login = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: json,
    body: JSON.stringify(scenario.loginAs),
  });
  if (!login.ok) throw new Error(`Login failed for ${scenario.loginAs.email}: ${login.status}`);
  const { token, user } = await login.json();
  const auth = { ...json, Authorization: `Bearer ${token}` };

  const cart = await (await fetch(`${base}/api/cart`, { headers: auth })).json();
  for (const item of cart.items) {
    await fetch(`${base}/api/cart/items/${item.productId}`, { method: 'DELETE', headers: auth });
  }
  for (const item of scenario.cartItems || []) {
    const res = await fetch(`${base}/api/cart/items`, { method: 'POST', headers: auth, body: JSON.stringify(item) });
    if (!res.ok) throw new Error(`Could not add product ${item.productId} to the cart: ${res.status}`);
  }

  await page.evaluateOnNewDocument(
    (t, u) => {
      localStorage.setItem('shoplite.token', t);
      localStorage.setItem('shoplite.user', u);
    },
    token,
    JSON.stringify(user),
  );
};
