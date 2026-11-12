// Cart behaviour with a cached API login (cy.session) and spies on the requests the UI makes.

describe('Cart with a cached session', () => {
  const user = Cypress.env('customer');

  beforeEach(() => {
    cy.resetCart();
    cy.loginByApi();
  });

  it('greets the logged-in user without going through the login form', () => {
    cy.visit('/');
    cy.byTestId('nav-greeting').should('have.text', `Hi, ${user.firstName}`);
  });

  it('sends the right body when adding to the cart', () => {
    cy.intercept('POST', '/api/cart/items').as('addItem');
    cy.addToCartFromProductPage(3, 2);

    cy.wait('@addItem').then(({ request, response }) => {
      expect(request.headers.authorization).to.match(/^Bearer .+/);
      expect(request.body).to.deep.equal({ productId: 3, quantity: 2 });
      expect(response.statusCode).to.eq(201);
    });
    cy.byTestId('message').should('have.text', 'Added to cart.');
    cy.byTestId('cart-count').should('have.text', '2');
  });

  it('shows totals in the cart', () => {
    cy.addToCartFromProductPage(3, 2);
    cy.byTestId('cart-count').should('have.text', '2');
    cy.visit('/cart');
    cy.byTestId('cart-item').should('have.length', 1);
    cy.byTestId('cart-subtotal').should('have.text', '$25.98');
    cy.byTestId('cart-shipping').should('have.text', '$4.99');
    cy.byTestId('cart-total').should('have.text', '$30.97');
  });

  it('shows the server message when stock ran out at checkout', () => {
    cy.addToCartFromProductPage(3, 1);
    cy.byTestId('cart-count').should('have.text', '1');
    cy.intercept('POST', '/api/orders', {
      statusCode: 409,
      body: { error: 'Not enough stock', productId: 3 },
    }).as('placeOrder');

    cy.visit('/cart');
    cy.byTestId('checkout-button').click();
    cy.wait('@placeOrder');
    cy.byTestId('message').should('have.text', 'Not enough stock');
    cy.location('pathname').should('eq', '/cart');
  });

  it('places a real order and lands on the order history', () => {
    cy.addToCartFromProductPage(1, 1);
    cy.byTestId('cart-count').should('have.text', '1');
    cy.visit('/cart');
    cy.byTestId('checkout-button').click();

    cy.location('pathname').should('eq', '/orders');
    cy.location('search').then((search) => {
      const orderId = new URLSearchParams(search).get('placed');
      cy.byTestId('message').should('have.text', `Thank you! Order #${orderId} has been placed.`);
      cy.contains('[data-testid="order-row"]', `#${orderId}`).should('contain.text', 'Testing Handbook');
    });
  });
});

describe('Session expiry', () => {
  it('sends the user to log in again when the token is rejected', () => {
    cy.loginByApi();
    cy.intercept('GET', '/api/cart', { statusCode: 401, body: { error: 'Invalid or expired token' } }).as('cart');
    cy.visit('/cart');
    cy.wait('@cart');
    cy.byTestId('message').should('contain.text', 'Invalid or expired token');
    cy.window().its('localStorage').invoke('getItem', 'shoplite.token').should('be.null');
  });
});
