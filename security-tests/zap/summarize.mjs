// Turns the ZAP baseline JSON report into a GitHub job summary table and annotations, using the
// FAIL/WARN/IGNORE actions from rules.tsv. ZAP itself decides the exit code; this is for reading.
// usage: node summarize.mjs <zap-report.json> <rules.tsv>
import { appendFileSync, existsSync, readFileSync } from 'node:fs';

const [reportPath, rulesPath] = process.argv.slice(2);
if (!existsSync(reportPath)) {
  console.log(`::error title=ZAP baseline::No report at ${reportPath}. Did the scan start?`);
  process.exit(0);
}

const actions = new Map(
  readFileSync(rulesPath, 'utf8')
    .split('\n')
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => line.split('\t'))
    .map(([id, action]) => [id, action]),
);

const RISK = ['Informational', 'Low', 'Medium', 'High'];
const report = JSON.parse(readFileSync(reportPath, 'utf8'));
const alerts = report.site
  .flatMap((site) => site.alerts)
  .map((a) => ({
    id: a.pluginid,
    name: a.name ?? a.alert,
    risk: RISK[Number(a.riskcode)] ?? a.riskcode,
    count: Number(a.count ?? a.instances?.length ?? 0),
    example: a.instances?.[0]?.uri ?? '',
    action: actions.get(a.pluginid) ?? 'WARN',
  }))
  .filter((a) => a.action !== 'IGNORE')
  .sort((x, y) => RISK.indexOf(y.risk) - RISK.indexOf(x.risk));

const lines = [
  `## OWASP ZAP baseline: ${alerts.filter((a) => a.action === 'FAIL').length} failing, ${alerts.length} reported`,
  '',
  '| Rule | Alert | Risk | Action | Instances | Example |',
  '|------|-------|------|--------|-----------|---------|',
  ...alerts.map((a) => `| ${a.id} | ${a.name} | ${a.risk} | ${a.action} | ${a.count} | ${a.example} |`),
  '',
];
console.log(lines.join('\n'));
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${lines.join('\n')}\n`);

for (const a of alerts) {
  const level = a.action === 'FAIL' ? 'error' : 'warning';
  console.log(`::${level} title=ZAP ${a.id}: ${a.name}::${a.risk} risk, ${a.count} instance(s), e.g. ${a.example}`);
}
