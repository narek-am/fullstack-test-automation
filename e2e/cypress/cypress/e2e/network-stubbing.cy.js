// Front-end behaviour that is hard to reach with real data: empty lists, server errors,
// slow responses. cy.intercept replaces the API response so only the UI is under test.

describe('Product list with stubbed API responses', () => {
  it('renders products from a fixture', () => {
    cy.intercept('GET', '/api/products?*', { fixture: 'products-two.json' }).as('products');
    cy.visit('/');
    cy.wait('@products');

    cy.byTestId('product-card').should('have.length', 2);
    cy.byTestId('result-count').should('have.text', '2 products found');
    cy.contains('[data-testid="product-card"]', 'Stubbed Sticker Pack')
      .find('[data-testid="product-stock"]')
      .should('have.text', 'Out of stock')
      .and('have.class', 'stock-out');
    cy.contains('[data-testid="product-card"]', 'Stubbed Notebook')
      .find('[data-testid="product-price"]')
      .should('have.text', '$9.99');
  });

  it('shows an empty result when the API returns no products', () => {
    cy.intercept('GET', '/api/products?*', { body: { items: [], total: 0 } }).as('products');
    cy.visit('/');
    cy.wait('@products');
    cy.byTestId('product-card').should('not.exist');
    cy.byTestId('result-count').should('have.text', '0 products found');
  });

  it('shows an error message when the API fails', () => {
    cy.intercept('GET', '/api/products?*', { statusCode: 500, body: { error: 'Internal server error' } }).as('products');
    cy.visit('/');
    cy.wait('@products');
    cy.byTestId('message')
      .should('be.visible')
      .and('have.class', 'error')
      .and('contain.text', 'Could not load products');
  });

  it('still works when the categories endpoint is down', () => {
    cy.intercept('GET', '/api/products/categories', { forceNetworkError: true }).as('categories');
    cy.visit('/');
    cy.byTestId('category-select').find('option').should('have.length', 1);
    cy.byTestId('product-card').should('have.length', 6);
  });

  it('keeps the page usable while the API is slow', () => {
    cy.intercept('GET', '/api/products?*', (req) => {
      req.on('response', (res) => res.setDelay(1500));
    }).as('slowProducts');
    cy.visit('/');
    cy.byTestId('search-input').should('be.enabled').type('mug');
    cy.wait('@slowProducts');
    cy.byTestId('product-card').should('have.length', 6);
  });
});

describe('Requests the UI sends', () => {
  it('sends search, category and sort as query parameters', () => {
    cy.intercept('GET', '/api/products?*').as('products');
    cy.visit('/');
    cy.wait('@products');

    cy.byTestId('search-input').type('book');
    cy.byTestId('category-select').select('books');
    cy.byTestId('sort-select').select('price_desc');
    cy.byTestId('search-button').click();

    cy.wait('@products').then(({ request, response }) => {
      const url = new URL(request.url);
      expect(url.searchParams.get('search')).to.eq('book');
      expect(url.searchParams.get('category')).to.eq('books');
      expect(url.searchParams.get('sort')).to.eq('price_desc');
      expect(response.statusCode).to.eq(200);
    });
    cy.location('search').should('include', 'sort=price_desc');
  });
});
