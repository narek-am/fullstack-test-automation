const crypto = require('node:crypto');
const request = require('supertest');
const { Kafka, logLevel } = require('kafkajs');
const { createApp } = require('../../app/src/app');
const { createKafkaPublisher } = require('../../app/src/services/events');
const { startBroker } = require('./kafkaBroker');

// End-to-end check of the event stream: an order placed through the API must produce exactly
// one well-formed `order.created` message on Kafka that matches what was stored.
describe('order.created events on Kafka', () => {
  const runId = crypto.randomBytes(4).toString('hex');
  const topic = `shoplite.orders.test-${runId}`;

  let broker;
  let publisher;
  let consumer;
  let app;
  const received = [];

  const waitForMessages = async (count, timeoutMs = 15_000) => {
    const start = Date.now();
    while (received.length < count) {
      if (Date.now() - start > timeoutMs) {
        throw new Error(`Expected ${count} messages, got ${received.length} after ${timeoutMs} ms`);
      }
      await new Promise((r) => setTimeout(r, 100));
    }
    return received.slice(0, count);
  };

  const login = async (email) => {
    const res = await request(app).post('/api/auth/login').send({ email, password: 'Passw0rd!' }).expect(200);
    return { Authorization: `Bearer ${res.body.token}` };
  };

  const placeOrder = async (auth, lines) => {
    for (const [productId, quantity] of lines) {
      await request(app).post('/api/cart/items').set(auth).send({ productId, quantity }).expect(201);
    }
    return (await request(app).post('/api/orders').set(auth).expect(201)).body;
  };

  beforeAll(async () => {
    broker = await startBroker();
    const kafka = new Kafka({ clientId: `shoplite-tests-${runId}`, brokers: broker.brokers, logLevel: logLevel.WARN });

    const admin = kafka.admin();
    await admin.connect();
    await admin.createTopics({ topics: [{ topic, numPartitions: 3 }], waitForLeaders: true });
    await admin.disconnect();

    consumer = kafka.consumer({ groupId: `shoplite-tests-${runId}` });
    await consumer.connect();
    await consumer.subscribe({ topic, fromBeginning: true });
    await consumer.run({
      eachMessage: async ({ partition, message }) => {
        received.push({
          partition,
          key: message.key?.toString(),
          value: JSON.parse(message.value.toString()),
        });
      },
    });

    // The real app wired to the real broker, as `KAFKA_BROKERS=... npm start` would do.
    app = createApp({ dbPath: ':memory:', loginRateLimit: 1000 });
    publisher = await createKafkaPublisher(broker.brokers.join(','), topic);
    app.locals.eventBus.addPublisher(publisher);
  });

  afterAll(async () => {
    await consumer?.disconnect();
    await publisher?.disconnect();
    await broker?.stop();
  });

  beforeEach(() => {
    received.length = 0;
  });

  it('publishes one message per order, keyed by order id, matching the stored order', async () => {
    const alice = await login('alice@shoplite.test');
    const order = await placeOrder(alice, [[1, 1], [3, 2]]);

    const [message] = await waitForMessages(1);

    expect(message.key).toBe(String(order.id));
    expect(message.value).toEqual({
      type: 'order.created',
      occurredAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/),
      payload: {
        orderId: order.id,
        userId: order.userId,
        totalCents: order.totalCents,
        items: [
          { productId: 1, quantity: 1 },
          { productId: 3, quantity: 2 },
        ],
      },
    });
    // Contains no personal data beyond the user id.
    expect(JSON.stringify(message.value)).not.toMatch(/@|password/i);
  });

  it('publishes one correctly keyed message for each of several orders', async () => {
    const bob = await login('bob@shoplite.test');
    const orders = [];
    for (let i = 0; i < 3; i += 1) orders.push(await placeOrder(bob, [[2, 1]]));

    const messages = await waitForMessages(3);
    const ids = messages.map((m) => m.value.payload.orderId).sort((a, b) => a - b);
    expect(ids).toEqual(orders.map((o) => o.id).sort((a, b) => a - b));
    // Keyed by order id: all future events of one order (shipped, cancelled...) would land on
    // the same partition, which is where Kafka guarantees ordering.
    for (const m of messages) {
      expect(m.key).toBe(String(m.value.payload.orderId));
    }
    expect(new Set(messages.map((m) => m.key)).size).toBe(3);
  });

  it('publishes nothing when checkout fails', async () => {
    const alice = await login('alice@shoplite.test');
    await request(app).post('/api/orders').set(alice).expect(400); // empty cart
    await new Promise((r) => setTimeout(r, 2_000));
    expect(received).toEqual([]);
  });

  it('the total in the event equals the sum of the order lines + shipping', async () => {
    const alice = await login('alice@shoplite.test');
    const order = await placeOrder(alice, [[5, 1]]); // keyboard, above free-shipping threshold
    const [message] = await waitForMessages(1);
    const subtotal = order.items.reduce((sum, i) => sum + i.quantity * i.unitPriceCents, 0);
    expect(message.value.payload.totalCents).toBe(subtotal + (subtotal >= 5000 ? 0 : 499));
  });
});
