// Security: real output of the security test suite, shown as a terminal, grouped by attack.
import { chromium } from '@playwright/test';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { GifRecorder, stage, terminal, ROOT } from '../lib.mjs';

function runSuite() {
  // Jest writes its results to stderr, so both streams are kept.
  const { stdout, stderr, status } = spawnSync('npx', ['jest', '--verbose', '--colors=false', 'api'], {
    cwd: join(ROOT, 'security-tests'), encoding: 'utf8',
  });
  if (status !== 0) throw new Error(`security tests failed:\n${stderr}`);
  return stdout + stderr;
}

export default async function security() {
  const output = runSuite();
  const lines = output.split('\n').map((l) => l.trimEnd());
  const passed = (re, n) => lines.filter((l) => /✓/.test(l) && re.test(l)).slice(0, n).map((l) => ({ text: l.trim().replace(/\s*\(\d+ ms\)$/, ''), color: '#86efac' }));
  const summary = lines.find((l) => /^Tests:/.test(l)) ?? '';

  const groups = [
    ['💉 SQL injection: trying to trick the database', passed(/finds nothing and leaks nothing|refused by the allow-list/, 4)],
    ['🔑 Break-in attempts: guessing passwords, forged and expired logins', passed(/blocks the client|rejects a token after logout|rejects an expired token|rejects a made-up token|same way/, 4)],
    ["🕵️ Peeking at other people's data", passed(/order to another|ignores a userId|stops a customer from changing stock|ignores prices and totals/, 4)],
    ['🧨 Malicious input: huge requests, broken data, hidden files', passed(/refuses JSON bodies over|does not serve files outside|__proto__|is a 400, not a crash/, 4)],
  ];

  const browser = await chromium.launch();
  const { page, show } = await stage(browser);
  const rec = new GifRecorder('security-test');
  const shown = [];
  for (const [title, results] of groups) {
    shown.push({ text: '' }, { text: title, color: '#fbbf24' });
    for (const r of results) {
      shown.push({ text: `  ${r.text}`, color: r.color });
      await show(terminal('🔒 Security tests: attacking the shop on purpose', 'Over 100 attacks a real hacker would try. Every one must be blocked.', shown.slice(-17), { prompt: 'security-tests › npm test' }));
      await rec.snap(page, 380);
    }
    rec.hold(500);
  }
  shown.push({ text: '' }, { text: summary.replace(/\s+/g, ' '), color: '#4ade80' });
  await show(terminal('🔒 Security tests: attacking the shop on purpose', 'Over 100 attacks a real hacker would try. Every one must be blocked.', shown.slice(-17), { prompt: 'security-tests › npm test' }));
  await rec.snap(page, 3200);

  rec.save();
  await browser.close();
}
