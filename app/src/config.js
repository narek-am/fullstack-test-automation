const path = require('node:path');

function intFromEnv(name, fallback) {
  const raw = process.env[name];
  const parsed = Number.parseInt(raw, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

module.exports = {
  port: intFromEnv('PORT', 3000),
  dbPath: process.env.DB_PATH || path.join(__dirname, '..', 'data', 'shoplite.db'),
  tokenTtlMinutes: intFromEnv('TOKEN_TTL_MINUTES', 60),
  loginRateLimit: intFromEnv('LOGIN_RATE_LIMIT', 10),
  chaosEnabled: process.env.CHAOS_ENABLED === 'true',
  kafkaBrokers: process.env.KAFKA_BROKERS || '',
};
