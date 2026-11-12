module.exports = {
  rootDir: __dirname,
  testEnvironment: 'node',
  testMatch: ['**/*.kafka.test.js'],
  // Starting a Kafka container can take a while on a cold CI runner.
  testTimeout: 60_000,
};
