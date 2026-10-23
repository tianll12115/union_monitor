const { test, expect } = require('./error-guard');

// BASIC-012: pure-keyboard access across the main paths — enter a community,
// drive search and sort, open a record detail, and close with Escape while
// restoring focus and the URL. No step relies on a pointer; there must be no
// focus trap (after closing the dialog, focus lands on a real element again).

test('[BASIC-012] pure keyboard enters a community and repo, drives search and sort, opens a record, and Escape restores focus and URL', async ({ page }) => {
  await page.goto('./#projects/ubs/overview');
  await expect(page.locator('#reload')).toBeEnabled();
  await expect(page.locator('#repositoryRows a[href="#ubs/repo/ubs-engine"]')).toBeVisible();

  // Keyboard community switch: Enter on a nav link follows the canonical entry.
  await page.locator('a[data-nav="triton"]').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#triton-view')).toBeVisible();
  await expect(page.locator('#ubs-view')).toBeHidden();
  await page.locator('a[data-nav="ubs"]').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#ubs-view')).toBeVisible();

  // Keyboard repo entry: Enter on the repository anchor.
  await page.locator('#repositoryRows a[href="#ubs/repo/ubs-engine"]').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#prRows tr[data-pr]').first()).toBeVisible();

  // Keyboard search: typing narrows to the exact PR whose identity matches.
  await page.locator('#query').focus();
  await page.keyboard.type('31');
  await expect(page.locator('#prRows tr[data-pr]')).toHaveCount(1);
  await expect(page.locator('#prRows tr[data-pr]')).toHaveAttribute('data-pr', '31');
  expect(page.url()).toContain('q=31');

  // Clear the search with the keyboard (select-all + delete), never a pointer.
  await page.locator('#query').focus();
  await page.keyboard.press('Control+A');
  await page.keyboard.press('Backspace');
  await expect(page.locator('#prRows tr[data-pr]').first()).toBeVisible();

  // Keyboard sort: ArrowDown on the focused select changes the value.
  await page.locator('#sort').focus();
  await page.keyboard.press('ArrowDown'); // e2e -> batches
  await expect(page.locator('#sort')).toHaveValue('batches');
  await page.keyboard.press('ArrowDown'); // batches -> submitted
  await expect(page.locator('#sort')).toHaveValue('submitted');
  expect(page.url()).toContain('sort=submitted');

  // Keyboard detail: Enter on the focused record title button opens the dialog.
  const firstTitle = page.locator('#prRows tr[data-pr] .pr-title').first();
  await firstTitle.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#detail')).toBeVisible();
  expect(page.url()).toContain('pr=');

  // Escape closes the dialog, clears the pr= identity, and focus is not trapped.
  await page.keyboard.press('Escape');
  await expect(page.locator('#detail')).toBeHidden();
  expect(page.url()).not.toContain('pr=');
  const activeTag = await page.evaluate(() => document.activeElement ? document.activeElement.tagName : '');
  expect(activeTag).toBeTruthy();
  expect(activeTag).not.toBe('BODY');

  // The reload control remains reachable (no focus trap after the dialog).
  await expect(page.locator('#reload')).toBeVisible();
});