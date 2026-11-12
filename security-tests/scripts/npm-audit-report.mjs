// Runs `npm audit` for every npm project in the repository and applies one rule:
//   - production dependencies (code that ships with the shop) must have no known vulnerabilities;
//   - dev-only test tooling is reported but does not fail the build, since it never reaches users.
// Writes a Markdown table to the GitHub job summary when running on GitHub Actions.
import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..', '..');
const LEVELS = ['critical', 'high', 'moderate', 'low'];

function audit(dir, omitDev) {
  const args = ['audit', '--json', ...(omitDev ? ['--omit=dev'] : [])];
  let output;
  try {
    output = execFileSync('npm', args, { cwd: resolve(root, dir), encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch (err) {
    output = err.stdout; // npm audit exits with 1 when it finds something
  }
  const { metadata } = JSON.parse(output);
  if (!metadata) throw new Error(`npm audit returned no metadata for ${dir}`);
  return metadata.vulnerabilities;
}

const format = (counts) =>
  counts.total === 0 ? 'none' : LEVELS.filter((l) => counts[l]).map((l) => `${counts[l]} ${l}`).join(', ');

const projects = execFileSync('git', ['ls-files', '*package-lock.json'], { cwd: root, encoding: 'utf8' })
  .trim()
  .split('\n')
  .map((file) => dirname(file));

const rows = projects.map((dir) => ({ dir, production: audit(dir, true), all: audit(dir, false) }));
const shipping = rows.filter((r) => r.production.total > 0);

const table = [
  '| Project | Production dependencies | All dependencies (incl. test tools) |',
  '|---------|-------------------------|-------------------------------------|',
  ...rows.map((r) => `| \`${r.dir}\` | ${r.production.total ? '❌ ' : '✅ '}${format(r.production)} | ${format(r.all)} |`),
].join('\n');

console.log(table);
if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## npm audit\n\n${table}\n\n`);
}
for (const r of rows.filter((row) => row.all.total > 0 && row.production.total === 0)) {
  console.log(`::notice title=npm audit (${r.dir})::Dev-only tooling: ${format(r.all)}. Not shipped, so not blocking.`);
}
for (const r of shipping) {
  console.log(`::error title=npm audit (${r.dir})::Production dependencies have known vulnerabilities: ${format(r.production)}`);
}
process.exit(shipping.length > 0 ? 1 : 0);
