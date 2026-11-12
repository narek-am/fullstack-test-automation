import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';

// WCAG 2.2 level A and AA, plus axe's best practices.
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'];

/** Runs axe on the current page and fails with a readable list of violations. */
export async function expectNoAxeViolations(page: Page, options: { exclude?: string[] } = {}) {
  let builder = new AxeBuilder({ page }).withTags(TAGS);
  for (const selector of options.exclude ?? []) builder = builder.exclude(selector);
  const { violations } = await builder.analyze();

  const report = violations.map(
    (v) => `[${v.impact}] ${v.id}: ${v.help}\n    ${v.nodes.map((n) => n.target.join(' ')).join('\n    ')}\n    ${v.helpUrl}`,
  );
  expect(report, `${violations.length} accessibility violation(s) on ${page.url()}`).toEqual([]);
}
