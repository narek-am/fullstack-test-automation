const { EventEmitter } = require('node:events');

// Domain events (e.g. order.created). In-memory by default; optionally mirrored to Kafka
// so the data-tests suite can verify the event stream end to end.
class EventBus extends EventEmitter {
  constructor() {
    super();
    this.history = [];
    this.publishers = [];
  }

  addPublisher(publisher) {
    this.publishers.push(publisher);
  }

  async publish(type, payload) {
    const event = { type, payload, occurredAt: new Date().toISOString() };
    this.history.push(event);
    this.emit(type, event);
    await Promise.all(this.publishers.map((p) => p.publish(event)));
    return event;
  }
}

async function createKafkaPublisher(brokers, topic = 'shoplite.orders') {
  // kafkajs is an optional dependency: only needed when KAFKA_BROKERS is set.
  // eslint-disable-next-line global-require
  const { Kafka, Partitioners } = require('kafkajs');
  const kafka = new Kafka({ clientId: 'shoplite', brokers: brokers.split(',') });
  // Default (murmur2) partitioner, same as the Java client: messages with the same key
  // always go to the same partition.
  const producer = kafka.producer({ createPartitioner: Partitioners.DefaultPartitioner });
  await producer.connect();
  return {
    async publish(event) {
      await producer.send({
        topic,
        messages: [{ key: String(event.payload.orderId ?? ''), value: JSON.stringify(event) }],
      });
    },
    disconnect: () => producer.disconnect(),
  };
}

module.exports = { EventBus, createKafkaPublisher };
