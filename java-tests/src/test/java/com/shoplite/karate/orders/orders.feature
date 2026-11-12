@parallel=false
Feature: Cart and orders
  Uses Bob's account so it does not interfere with other suites that use Alice.
  Scenarios share his cart, so they run one after another (@parallel=false).

  Background:
    * url baseUrl
    * def schemas = read('classpath:com/shoplite/karate/common/schemas.json')
    * def bob = call read('classpath:com/shoplite/karate/common/login.feature') users.bob
    * configure headers = bob.authHeader
    # start every scenario with an empty cart
    Given path '/api/cart'
    When method get
    * def lines = response.items
    * karate.forEach(lines, x => karate.call('classpath:com/shoplite/karate/orders/remove-line.feature', { productId: x.productId }))

  Scenario: Cart totals follow the pricing rules
    Given path '/api/cart/items'
    And request { productId: 3, quantity: 2 }
    When method post
    Then status 201
    And match response.items == '#[1] schemas.cartLine'
    And match response.subtotalCents == response.items[0].unitPriceCents * 2
    And match response.totalCents == response.subtotalCents + response.shippingCents

  Scenario: Placing an order reduces stock and empties the cart
    Given path '/api/products/1'
    When method get
    * def stockBefore = response.stock

    Given path '/api/cart/items'
    And request { productId: 1, quantity: 2 }
    When method post
    Then status 201
    * def expectedTotal = response.totalCents

    Given path '/api/orders'
    When method post
    Then status 201
    And match response contains { status: 'PLACED', totalCents: '#(expectedTotal)' }
    And match response.items == [{ productId: 1, name: '#string', quantity: 2, unitPriceCents: '#number' }]
    * def orderId = response.id

    Given path '/api/products/1'
    When method get
    Then match response.stock == stockBefore - 2

    Given path '/api/cart'
    When method get
    Then match response.items == []

    Given path '/api/orders', orderId
    When method get
    Then status 200
    And match response.id == orderId

  Scenario: Another customer cannot read Bob's order
    Given path '/api/cart/items'
    And request { productId: 3, quantity: 1 }
    When method post
    Then status 201
    Given path '/api/orders'
    When method post
    Then status 201
    * def orderId = response.id

    * def alice = call read('classpath:com/shoplite/karate/common/login.feature') users.alice
    * configure headers = alice.authHeader
    Given path '/api/orders', orderId
    When method get
    Then status 404

  Scenario: Stock limit is enforced
    Given path '/api/cart/items'
    And request { productId: 5, quantity: 1000 }
    When method post
    Then status 400

    Given path '/api/cart/items'
    And request { productId: 5, quantity: 99 }
    When method post
    Then status 409
    And match response == { error: 'Not enough stock', available: '#number' }
