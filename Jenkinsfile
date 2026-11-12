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
                        // Kafka tests start a Kafka container with Testcontainers (Docker needed on the agent)
                        dir('data-tests') { sh 'npm ci && npm test -- --ci && npm run test:kafka -- --ci' }
                    }
                }
                stage('Pact') {
                    steps {
                        dir('contract-tests') { sh 'npm ci && npm test' }
                    }
                }
                stage('Security tests') {
                    steps {
                        dir('security-tests') { sh 'npm ci && npm test -- --ci' }
                        // Fails only if production dependencies have known vulnerabilities
                        sh 'node security-tests/scripts/npm-audit-report.mjs'
                    }
                }
            }
        }

        stage('UI tests') {
            parallel {
                stage('Playwright') {
                    steps {
                        dir('e2e/playwright') {
                            // Screenshot project (visual) needs a macOS agent; functional projects run anywhere
                            sh 'npm ci && npx playwright install chromium firefox webkit && npx playwright test --project=chromium --project=firefox --project=webkit --project=a11y --project=mobile-android --project=mobile-ios'
                        }
                    }
                    post {
                        always {
                            junit allowEmptyResults: true, testResults: 'e2e/playwright/test-results/junit.xml'
                            archiveArtifacts allowEmptyArchive: true, artifacts: 'e2e/playwright/playwright-report/**'
                        }
                    }
                }
                stage('Chaos & architecture') {
                    steps {
                        dir('cfr-tests') { sh 'npm ci && npm run architecture && npx playwright install chromium && npm run chaos' }
                    }
                }
                stage('Pa11y') {
                    steps {
                        // Uses the agent's Google Chrome; set CHROME_PATH if it is not on the default path
                        dir('accessibility-tests') { sh 'PUPPETEER_SKIP_DOWNLOAD=true npm ci && npm test' }
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
