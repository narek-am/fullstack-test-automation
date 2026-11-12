// Runs after the page is ready, before the screenshot. Removes sources of flaky diffs,
// then performs the built-in interactions (hover, click, key press) for the scenario.
module.exports = async (page, scenario) => {
  await page.addStyleTag({
    content: `
      *, *::before, *::after { animation: none !important; transition: none !important; caret-color: transparent !important; }
      /* Whether the scrollbar takes up space depends on the machine (macOS hides it with a trackpad,
         shows it with a mouse, as on the CI runner), so screenshots ignore the reserved gutter. */
      html { scrollbar-gutter: auto !important; }
    `,
  });
  await page.evaluate(() => document.fonts.ready);

  if (scenario.waitForResultCount) {
    // The "no results" page has no element to wait for, so wait for the result count text.
    await page.waitForFunction(() => /found/.test(document.querySelector('[data-testid="result-count"]')?.textContent || ''));
  }

  if (scenario.hoverSelector) {
    await page.waitForSelector(scenario.hoverSelector);
    await page.hover(scenario.hoverSelector);
  }
  if (scenario.clickSelector) {
    await page.waitForSelector(scenario.clickSelector);
    await page.click(scenario.clickSelector);
  }
  for (const { selector, keyPress } of scenario.keyPressSelectors || []) {
    await page.waitForSelector(selector);
    await page.type(selector, keyPress);
  }
  if (scenario.postInteractionWait) {
    await page.waitForSelector(scenario.postInteractionWait);
  }
};
