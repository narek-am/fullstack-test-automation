// Custom commands shared by all specs.

// Find elements by their data-testid attribute.
Cypress.Commands.add('byTestId', (id, options) => cy.get(`[data-testid="${id}"]`, options));

// Log in through the API and cache the session with cy.session, so the login request
// runs once per spec instead of once per test.
Cypress.Commands.add('loginByApi', (user = Cypress.env('customer')) => {
  cy.session(
    ['api-login', user.email],
    () => {
      cy.request('POST', '/api/auth/login', { email: user.email, password: user.password }).then(({ body }) => {
        window.localStorage.setItem('shoplite.token', body.token);
        window.localStorage.setItem('shoplite.user', JSON.stringify(body.user));
      });
    },
    {
      validate() {
        // Session is valid only if the server still accepts the stored token.
        cy.window().then((win) => {
          const token = win.localStorage.getItem('shoplite.token');
          cy.request({ url: '/api/auth/me', headers: { Authorization: `Bearer ${token}` } })
            .its('status').should('eq', 200);
        });
      },
    },
  );
});

// Empty the user's cart through the API so each test starts from a known state.
Cypress.Commands.add('resetCart', (user = Cypress.env('customer')) => {
  cy.request('POST', '/api/auth/login', { email: user.email, password: user.password }).then(({ body }) => {
    const headers = { Authorization: `Bearer ${body.token}` };
    cy.request({ url: '/api/cart', headers }).then(({ body: cart }) => {
      cart.items.forEach((item) => {
        cy.request({ method: 'DELETE', url: `/api/cart/items/${item.productId}`, headers });
      });
    });
  });
});

// Add a product to the cart through the UI.
Cypress.Commands.add('addToCartFromProductPage', (productId, quantity = 1) => {
  cy.visit(`/product?id=${productId}`);
  cy.byTestId('quantity-input').clear().type(String(quantity));
  cy.byTestId('add-to-cart').click();
});
