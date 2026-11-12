// Prints a GitHub Actions error annotation for every failed BackstopJS comparison, so the
// reason for a red visual job shows on the run summary page without opening logs or artifacts.
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const testDir = 'backstop_data/bitmaps_test';
if (!existsSync(testDir)) {
  console.log('::error title=Visual tests::No BackstopJS results found (did the capture step crash?)');
  process.exit(0);
}
const latest = readdirSync(testDir).sort().pop();
const { tests } = JSON.parse(readFileSync(join(testDir, latest, 'report.json'), 'utf8'));
const failed = tests.filter((t) => t.status !== 'pass');

console.log(`BackstopJS: ${tests.length - failed.length} passed, ${failed.length} failed`);
for (const { pair } of failed) {
  const diff = pair.diff ?? {};
  const details = pair.engineErrorMsg
    ? `engine error: ${pair.engineErrorMsg}`
    : `${diff.misMatchPercentage ?? '?'}% of pixels differ` +
      (diff.isSameDimensions === false
        ? ` (size changed: ${JSON.stringify(diff.dimensionDifference)})`
        : '');
  console.log(`::error title=Visual diff: ${pair.label} (${pair.viewportLabel})::${details}`);
}
