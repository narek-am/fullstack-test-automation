Feature: Authentication

  Background:
    * url baseUrl

  Scenario: Successful login returns a token and a profile without secrets
    Given path '/api/auth/login'
    And request users.alice
    When method post
    Then status 200
    And match response ==
      """
      {
        token: '#string',
        user: { id: '#number', email: 'alice@shoplite.test', name: 'Alice Customer', role: 'customer' }
      }
      """
    And match response.user !contains { password_hash: '#notnull' }

  Scenario Outline: Login with <case> is rejected with <status>
    Given path '/api/auth/login'
    And request body
    When method post
    Then status <status>

    Examples:
      | case             | body!                                                  | status |
      | wrong password   | { email: 'alice@shoplite.test', password: 'nope' }     | 401    |
      | unknown user     | { email: 'nobody@shoplite.test', password: 'nope' }    | 401    |
      | bad email format | { email: 'alice', password: 'Passw0rd!' }              | 400    |
      | missing password | { email: 'alice@shoplite.test' }                       | 400    |
      | empty body       | {}                                                     | 400    |

  Scenario: The token works for /me until logout
    * def session = call read('classpath:com/shoplite/karate/common/login.feature') users.bob
    Given path '/api/auth/me'
    And headers session.authHeader
    When method get
    Then status 200
    And match response.email == users.bob.email

    Given path '/api/auth/logout'
    And headers session.authHeader
    When method post
    Then status 204

    Given path '/api/auth/me'
    And headers session.authHeader
    When method get
    Then status 401
