// Seeded accounts (app/src/seed.js). Each spec that changes a cart uses its own user,
// so spec files can run in parallel against the same server.
export const users = {
  alice: { email: 'alice@shoplite.test', password: 'Passw0rd!', firstName: 'Alice' },
  bob: { email: 'bob@shoplite.test', password: 'Passw0rd!', firstName: 'Bob' },
  admin: { email: 'admin@shoplite.test', password: 'Adm1nPass!', firstName: 'Ada' },
} as const;

export type TestUser = (typeof users)[keyof typeof users];
