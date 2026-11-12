@ignore
Feature: Helper: remove one product from the current user's cart

  Scenario:
    Given url baseUrl
    And path '/api/cart/items', productId
    When method delete
    Then status 200
