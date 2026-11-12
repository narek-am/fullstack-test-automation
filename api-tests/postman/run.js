// Starts ShopLite on a free port with a throwaway database, runs both Postman
// collections with Newman, then shuts the app down. Exit code = test result.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const newman = require('newman');
const { createApp } = require('../../app/src/app');

const reportsDir = path.join(__dirname, 'reports');

function runCollection(options) {
  return new Promise((resolve, reject) => {
    newman.run(options, (err, summary) => (err ? reject(err) : resolve(summary)));
  });
}

async function main() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'shoplite-newman-'));
  // Raise the login rate limit: the data-driven run logs in many times on purpose.
  // Rate limiting itself is covered by the security test suite.
  const app = createApp({ dbPath: path.join(tmp, 'test.db'), loginRateLimit: 1000 });
  const server = app.listen(0);
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  console.log(`ShopLite started at ${baseUrl}`);

  const common = {
    environment: path.join(__dirname, 'local.postman_environment.json'),
    envVar: [{ key: 'baseUrl', value: baseUrl }],
    reporters: ['cli', 'junit', 'htmlextra'],
  };

  try {
    const suites = [
      { name: 'api', collection: 'shoplite.postman_collection.json' },
      { name: 'login-data-driven', collection: 'login-data-driven.postman_collection.json', iterationData: 'data/login-cases.csv' },
    ];
    let failures = 0;
    for (const suite of suites) {
      const summary = await runCollection({
        ...common,
        collection: path.join(__dirname, suite.collection),
        iterationData: suite.iterationData && path.join(__dirname, suite.iterationData),
        reporter: {
          junit: { export: path.join(reportsDir, `${suite.name}-junit.xml`) },
          htmlextra: { export: path.join(reportsDir, `${suite.name}.html`) },
        },
      });
      failures += summary.run.failures.length;
    }
    process.exitCode = failures > 0 ? 1 : 0;
  } finally {
    server.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
