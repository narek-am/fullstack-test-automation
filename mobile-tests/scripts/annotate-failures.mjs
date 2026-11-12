// After a failed run in CI: posts the most relevant error lines from the WebdriverIO and Appium
// logs as one GitHub annotation, so the cause is visible on the run page without downloading logs.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const files = [
  join(root, 'appium.log'),
  ...(existsSync(join(root, 'logs')) ? readdirSync(join(root, 'logs')).map((f) => join(root, 'logs', f)) : []),
].filter(existsSync);

const interesting = /error|fail|exception|unable|could not|cannot|timed? ?out|not found|refused/i;
const lines = [];
for (const file of files) {
  const matches = readFileSync(file, 'utf8')
    .split('\n')
    .filter((line) => interesting.test(line))
    .map((line) => line.replace(/\x1b\[[0-9;]*m/g, '').trim().slice(0, 300));
  // The last distinct lines are usually the ones that explain the failure.
  const distinct = [...new Set(matches)].slice(-15);
  if (distinct.length) lines.push(`== ${file.slice(root.length + 1)}`, ...distinct);
}

const message = lines.length ? lines.join('\n') : `No error lines found in: ${files.map((f) => f.slice(root.length + 1)).join(', ') || 'no log files'}`;
// Annotation messages are one line; GitHub decodes %0A back into line breaks.
console.log(`::error title=Appium run failed::${message.replace(/%/g, '%25').replace(/\r/g, '').replace(/\n/g, '%0A')}`);
