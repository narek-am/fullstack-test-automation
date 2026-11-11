const config = require('./config');
const { createApp } = require('./app');
const { createKafkaPublisher } = require('./services/events');

async function main() {
  const app = createApp();
  if (config.kafkaBrokers) {
    const publisher = await createKafkaPublisher(config.kafkaBrokers);
    app.locals.eventBus.addPublisher(publisher);
    console.log(`Publishing domain events to Kafka at ${config.kafkaBrokers}`);
  }
  app.listen(config.port, () => {
    console.log(`ShopLite running at http://localhost:${config.port}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
