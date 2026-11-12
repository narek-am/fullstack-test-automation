// Architecture rules for ShopLite, checked by dependency-cruiser on every push.
// Run from app/ (so package.json is ShopLite's): npm run architecture (in cfr-tests/)
//
// Intended layering of the server (app/src):
//
//   index.js -> app.js -> routes/ -> services/
//                      -> middleware/
//                      -> db.js -> seed.js
//
// routes/ handle HTTP only; services/ hold logic that knows nothing about HTTP; db.js is the only
// module that talks to SQLite. The browser code (app/public/js) is a separate world.

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    // --- General hygiene ---
    {
      name: 'no-circular',
      severity: 'error',
      comment: 'Circular dependencies make load order fragile and modules impossible to test alone.',
      from: {},
      to: { circular: true },
    },
    {
      name: 'no-orphans',
      severity: 'error',
      comment: 'A module nobody imports is dead code (entry points excepted).',
      from: { orphan: true, pathNot: ['^src/index\\.js$', '^public/js/pages/'] },
      to: {},
    },
    {
      name: 'not-to-unresolvable',
      severity: 'error',
      from: {},
      to: { couldNotResolve: true },
    },
    {
      name: 'not-to-dev-dependencies',
      severity: 'error',
      comment: 'Production code must not need packages that are only installed for development (jest, supertest...).',
      from: { path: '^src/' },
      to: { dependencyTypes: ['npm-dev'] },
    },

    // --- Server layering ---
    {
      name: 'routes-are-independent',
      severity: 'error',
      comment: 'One route module must not reach into another; shared logic belongs in services/.',
      from: { path: '^src/routes/([^/]+)\\.js$' },
      to: { path: '^src/routes/', pathNot: '^src/routes/$1\\.js$' },
    },
    {
      name: 'only-app-wires-routes',
      severity: 'error',
      comment: 'Routes are mounted in one place, app.js.',
      from: { pathNot: ['^src/app\\.js$', '^src/routes/'] },
      to: { path: '^src/routes/' },
    },
    {
      name: 'services-know-nothing-about-http-or-storage',
      severity: 'error',
      comment: 'services/ hold logic that knows nothing about HTTP; a database connection is passed in, never imported.',
      from: { path: '^src/services/' },
      to: { path: ['^src/(routes|middleware)/', '^src/(app|db|index)\\.js$', '^express$'] },
    },
    {
      name: 'middleware-does-not-use-routes-or-db',
      severity: 'error',
      from: { path: '^src/middleware/' },
      to: { path: ['^src/routes/', '^src/db\\.js$'] },
    },
    {
      name: 'only-db-talks-to-sqlite',
      severity: 'error',
      comment: 'All SQL connection handling lives in db.js; routes get the connection passed in.',
      from: { pathNot: '^src/db\\.js$' },
      to: { path: '^node:sqlite$|^sqlite$' },
    },
    {
      name: 'kafka-stays-optional',
      severity: 'error',
      comment: 'kafkajs is an optional dependency: only the event publisher may import it, and lazily.',
      from: { pathNot: '^src/services/events\\.js$' },
      to: { path: 'kafkajs' },
    },
    {
      name: 'only-entry-points-read-config',
      severity: 'error',
      comment: 'Configuration is read once and passed down, so tests can override it with createApp(overrides).',
      from: { path: '^src/', pathNot: ['^src/(app|index)\\.js$'] },
      to: { path: '^src/config\\.js$' },
    },

    // --- Browser code ---
    {
      name: 'browser-code-stays-in-the-browser',
      severity: 'error',
      from: { path: '^public/' },
      to: { path: '^src/' },
    },
    {
      name: 'pages-do-not-import-pages',
      severity: 'error',
      comment: 'Each page script is an entry point; shared code goes in public/js/*.js.',
      from: { path: '^public/js/pages/([^/]+)\\.js$' },
      to: { path: '^public/js/pages/', pathNot: '^public/js/pages/$1\\.js$' },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    includeOnly: ['^src/', '^public/js/', 'node_modules', '^node:'],
    builtInModules: { add: ['node:sqlite'] },
    reporterOptions: {
      dot: { collapsePattern: 'node_modules/[^/]+' },
    },
  },
};
