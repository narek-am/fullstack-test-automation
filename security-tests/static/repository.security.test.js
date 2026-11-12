const { execFileSync } = require('node:child_process');
const path = require('node:path');

// Threat model: T9 (secrets committed to git). Talisman scans file contents; this test guards the
// files that must never be tracked at all, whatever they contain.
// Talisman does flag ".env" names, but only as low severity, and its custom_severities setting
// does not apply to file-name rules (checked in the v1.37.0 source), so this check is explicit.

const repoRoot = path.join(__dirname, '..', '..');
const tracked = execFileSync('git', ['ls-files'], { cwd: repoRoot, encoding: 'utf8' }).trim().split('\n');

it('lists the tracked files', () => {
  expect(tracked.length).toBeGreaterThan(50);
});

it.each([
  ['.env files (examples are fine)', /(^|\/)\.env(\.(?!example$)[^/]+)?$/],
  ['SQLite databases', /\.(db|sqlite3?)$/],
  ['private keys and certificates', /(^|\/)id_(rsa|dsa|ecdsa|ed25519)$|\.(pem|key|p12|pfx)$/],
  ['npm credentials', /(^|\/)\.npmrc$/],
])('does not track %s', (_, pattern) => {
  expect(tracked.filter((file) => pattern.test(file))).toEqual([]);
});
