@ignore
Feature: Reusable login, called from other features

  # Usage: * def session = call read('classpath:com/shoplite/karate/common/login.feature') users.alice
  Scenario:
    Given url baseUrl
    And path '/api/auth/login'
    And request { email: '#(email)', password: '#(password)' }
    When method post
    Then status 200
    * def token = response.token
    * def authHeader = { Authorization: '#("Bearer " + token)' }
