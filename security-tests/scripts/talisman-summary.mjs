// Prints each Talisman finding as a GitHub Actions annotation and adds a table to the job summary,
// so the reason for a failed secret scan is visible on the run page without opening the logs.
// usage: node talisman-summary.mjs <talisman_report dir>
import { appendFileSync, existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.argv[2] ?? 'talisman_report';
const reports = existsSync(dir)
  ? readdirSync(dir, { recursive: true }).filter((f) => f.endsWith('.json')).map((f) => join(dir, f))
  : [];
if (reports.length === 0) {
  console.log(`::warning title=Talisman::No JSON report found in ${dir}`);
  process.exit(0);
}

const rows = [];
for (const file of reports) {
  const { results = [] } = JSON.parse(readFileSync(file, 'utf8'));
  for (const result of results) {
    for (const [list, level] of [['failure_list', 'error'], ['warning_list', 'warning']]) {
      for (const finding of result[list] ?? []) {
        rows.push({
          level,
          file: result.filename,
          type: finding.type,
          severity: finding.severity ?? '',
          message: String(finding.message ?? '').replace(/\s+/g, ' ').slice(0, 300),
          commits: (finding.commits ?? []).map((c) => c.slice(0, 7)).join(' '),
        });
      }
    }
  }
}

// GitHub shows at most 10 annotations of each level per step, so group the findings by file.
const byFile = new Map();
for (const r of rows) {
  const key = `${r.level}|${r.file}`;
  byFile.set(key, [...(byFile.get(key) ?? []), r]);
}
const groups = [...byFile.values()].sort((a, b) => (a[0].level === 'error' ? -1 : 1) - (b[0].level === 'error' ? -1 : 1));
for (const findings of groups) {
  const [{ level, file }] = findings;
  const kinds = [...new Set(findings.map((f) => `${f.type} (${f.severity})`))].join(', ');
  const first = findings[0].message.slice(0, 160);
  console.log(`::${level} file=${file},title=Talisman: ${findings.length} finding(s) in ${file}::${kinds}. First: ${first}`);
}
const table = [
  `## Talisman: ${rows.filter((r) => r.level === 'error').length} failures, ${rows.filter((r) => r.level === 'warning').length} warnings`,
  '',
  '| Level | File | Type | Severity | Message | Commits |',
  '|-------|------|------|----------|---------|---------|',
  ...rows.map((r) => `| ${r.level} | \`${r.file}\` | ${r.type} | ${r.severity} | ${r.message.replace(/\|/g, '\\|')} | ${r.commits} |`),
  '',
].join('\n');
console.log(table);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, table);
