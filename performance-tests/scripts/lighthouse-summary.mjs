// Shows Lighthouse CI results on the GitHub run page: an error annotation per failed budget and a
// job summary table with the median-run metrics per page. Run after `lhci autorun`.
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const assertionsFile = join(root, '.lighthouseci', 'assertion-results.json');
const manifestFile = join(root, 'lighthouse', 'results', 'manifest.json');
const path = (url) => new URL(url).pathname + new URL(url).search;

const lines = ['## Lighthouse CI', ''];

const failed = existsSync(assertionsFile)
  ? JSON.parse(readFileSync(assertionsFile, 'utf8')).filter((a) => !a.passed)
  : [];
for (const a of failed) {
  const rule = a.auditProperty ? `${a.auditId}.${a.auditProperty}` : a.auditId;
  console.log(`::${a.level === 'warn' ? 'warning' : 'error'} title=Lighthouse budget: ${rule} (${path(a.url)})::` +
    `expected ${a.operator} ${a.expected}, found ${Math.round(a.actual * 1000) / 1000}`);
}
lines.push(failed.length ? `**${failed.length} budget(s) failed**, see the annotations.` : 'All budgets passed.', '');

if (existsSync(manifestFile)) {
  lines.push('| Page | Perf | FCP | LCP | TBT | CLS | Size | Requests |', '|---|---|---|---|---|---|---|---|');
  for (const run of JSON.parse(readFileSync(manifestFile, 'utf8')).filter((r) => r.isRepresentativeRun)) {
    const report = JSON.parse(readFileSync(run.jsonPath, 'utf8'));
    const a = report.audits;
    const total = a['resource-summary'].details.items.find((i) => i.resourceType === 'total');
    const ms = (id) => `${Math.round(a[id].numericValue)} ms`;
    lines.push(`| ${path(run.url)} | ${report.categories.performance.score} | ${ms('first-contentful-paint')} | ` +
      `${ms('largest-contentful-paint')} | ${ms('total-blocking-time')} | ` +
      `${a['cumulative-layout-shift'].numericValue.toFixed(3)} | ${(total.transferSize / 1024).toFixed(1)} KB | ${total.requestCount} |`);
  }
}

console.log(lines.join('\n'));
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${lines.join('\n')}\n`);
