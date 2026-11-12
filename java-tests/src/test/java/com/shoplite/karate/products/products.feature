Feature: Products API

  Background:
    * url baseUrl
    * def schemas = read('classpath:com/shoplite/karate/common/schemas.json')

  Scenario: Every product in the list matches the schema
    Given path '/api/products'
    When method get
    Then status 200
    And match response == { items: '#[6] schemas.product', total: 6 }
    And match header Content-Type contains 'application/json'

  Scenario: Products are sorted by name by default
    Given path '/api/products'
    When method get
    Then status 200
    * def names = $response.items[*].name
    * def sorted = karate.sort(names, x => x)
    And match names == sorted

  Scenario: Search is case-insensitive
    Given path '/api/products'
    And param search = 'HANDBOOK'
    When method get
    Then status 200
    And match response.items[*].sku == ['BK-001']

  Scenario: Category filter only returns that category
    Given path '/api/products'
    And param category = 'merch'
    When method get
    Then status 200
    And match each response.items contains { category: 'merch' }
    And match response.total == 2

  Scenario: Sold-out products are flagged
    Given path '/api/products'
    When method get
    Then status 200
    * def soldOut = karate.filter(response.items, x => x.stock == 0)
    And match each soldOut contains { inStock: false }

  Scenario Outline: Invalid request <path> returns <status>
    Given url baseUrl + '<path>'
    When method get
    Then status <status>
    And match response.error == '#string'

    Examples:
      | path                       | status |
      | /api/products/9999         | 404    |
      | /api/products/abc          | 400    |
      | /api/products?sort=newest  | 400    |
      | /api/unknown               | 404    |
