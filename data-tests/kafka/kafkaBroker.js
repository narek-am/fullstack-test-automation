const { KafkaContainer } = require('@testcontainers/kafka');

const KAFKA_IMAGE = 'confluentinc/cp-kafka:7.7.1';

/**
 * Returns Kafka bootstrap servers for the tests.
 * - KAFKA_BROKERS set (e.g. a local broker): use it.
 * - Otherwise: start a throwaway single-node Kafka (KRaft mode) with Testcontainers. Needs Docker.
 */
async function startBroker() {
  if (process.env.KAFKA_BROKERS) {
    return { brokers: process.env.KAFKA_BROKERS.split(','), stop: async () => {} };
  }
  const container = await new KafkaContainer(KAFKA_IMAGE).withKraft().start();
  return {
    brokers: [`${container.getHost()}:${container.getMappedPort(9093)}`],
    stop: () => container.stop(),
  };
}

module.exports = { startBroker };
