// Jenkins equivalent of .github/workflows/ci.yml.
// Expects the NodeJS and JDK tool installations below to be configured in
// Manage Jenkins > Tools, and the Playwright/Cypress system dependencies on the agent.
pipeline {
    agent any

    tools {
        nodejs 'node-24'
        jdk 'jdk-21'
    }

    options {
        timeout(time: 30, unit: 'MINUTES')
        timestamps()
        disableConcurrentBuilds(abortPrevious: true)
        buildDiscarder(logRotator(numToKeepStr: '20'))
    }

    environment {
        CI = 'true'
    }

    stages {
        stage('Install app') {
            steps {
                dir('app') { sh 'npm ci' }
            }
        }

        stage('Unit & integration') {
            steps {
                dir('app') { sh 'npx jest --ci --coverage --reporters=default' }
            }
        }

        stage('Service & contract tests') {
            parallel {
                stage('Postman / Newman') {
                    steps {
                        dir('api-tests/postman') { sh 'npm ci && npm test' }
                    }
                    post {
                        always { junit allowEmptyResults: true, testResults: 'api-tests/postman/reports/*-junit.xml' }
                    }
                }
                stage('REST Assured + Karate') {
                    steps {
                        dir('java-tests') { sh './mvnw -B test' }
                    }
                    post {
                        always { junit allowEmptyResults: true, testResults: 'java-tests/target/surefire-reports/*.xml' }
                    }
                }
                stage('Data quality') {
                    steps {
                        dir('data-tests') { sh 'npm ci && npm test -- --ci' }
                    }
                }
                stage('Pact') {
                    steps {
                        dir('contract-tests') { sh 'npm ci && npm test' }
                    }
                }
            }
        }

        stage('UI tests') {
            parallel {
                stage('Playwright') {
                    steps {
                        dir('e2e/playwright') {
                            sh 'npm ci && npx playwright install chromium firefox webkit && npx playwright test'
                        }
                    }
                    post {
                        always {
                            junit allowEmptyResults: true, testResults: 'e2e/playwright/test-results/junit.xml'
                            archiveArtifacts allowEmptyArchive: true, artifacts: 'e2e/playwright/playwright-report/**'
                        }
                    }
                }
                stage('Cypress') {
                    steps {
                        dir('e2e/cypress') { sh 'npm ci && npm test' }
                    }
                    post {
                        failure { archiveArtifacts allowEmptyArchive: true, artifacts: 'e2e/cypress/cypress/screenshots/**' }
                    }
                }
            }
        }
    }

    post {
        always {
            archiveArtifacts allowEmptyArchive: true, artifacts: 'app/coverage/**'
        }
    }
}
