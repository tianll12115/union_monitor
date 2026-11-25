const { test, expect } = require('./error-guard');

test('motion is shared across views and becomes immediate with reduced motion', async ({ page }) => {
  await page.goto('./#ubs/repo/ubs-engine');
  const record = page.locator('#prRows .pr-title').first();
  await record.click();
  const dialog = page.locator('#detail');
  const duration = () => dialog.evaluate(element => getComputedStyle(element).transitionDuration);
  expect(await duration()).toContain('0.22s');
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'dark' });
  await record.click();
  expect(await duration()).toBe('0s');
  await expect(dialog).toBeVisible();
  expect(await dialog.evaluate(element => getComputedStyle(element).backgroundColor)).toBe('rgb(26, 33, 43)');
  await page.keyboard.press('Escape');
  await expect(record).toBeFocused();
});

test('navigator moves before release without rebuilding records or committing the range', async ({ page }) => {
  await page.goto('./#projects/triton/engineering');
  await page.getByRole('button', { name: '24 小时', exact: true }).click();
  const slider = page.getByRole('slider', { name: '时间范围起点' });
  const record = await page.locator('#triton-view .row').first().elementHandle();
  const handle = await slider.elementHandle();
  await slider.scrollIntoViewIfNeeded();
  const box = await slider.boundingBox();
  const original = await slider.getAttribute('aria-valuenow');
  const route = page.url();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x - 25, box.y + box.height / 2, { steps: 8 });
  await expect(slider).not.toHaveAttribute('aria-valuenow', original);
  expect(await handle.evaluate(element => element.isConnected)).toBe(true);
  expect(await record.evaluate(element => element.isConnected)).toBe(true);
  expect(page.url()).toBe(route);
  await page.mouse.up();
  await expect.poll(() => page.url()).not.toBe(route);
  expect(await record.evaluate(element => element.isConnected)).toBe(false);
});

test('canceling capture restores the last committed time range', async ({ page }) => {
  await page.goto('./#projects/triton/engineering');
  await page.getByRole('button', { name: '24 小时', exact: true }).click();
  const nav = page.locator('#triton-view svg.nav-svg');
  const slider = page.getByRole('slider', { name: '时间范围起点' });
  const original = await slider.getAttribute('aria-valuenow');
  const duration = page.locator('[data-role="rangeCount"]');
  const committedDuration = await duration.innerText();
  const url = page.url();
  await slider.scrollIntoViewIfNeeded();
  const box = await slider.boundingBox();
  await nav.evaluate(element => element.addEventListener('pointerdown', event => {
    element.dataset.testPointer = event.pointerId;
  }, { once: true }));
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x - 25, box.y + box.height / 2);
  await expect(slider).not.toHaveAttribute('aria-valuenow', original);
  const preview = await slider.getAttribute('aria-valuenow');
  await expect(duration).not.toHaveText(committedDuration);
  const width = await nav.evaluate(element => element.viewBox.baseVal.width);
  await page.setViewportSize({ width: 1080, height: 800 });
  await expect.poll(() => nav.evaluate(element => element.viewBox.baseVal.width)).not.toBe(width);
  await expect(slider).toHaveAttribute('aria-valuenow', preview);
  await nav.evaluate(element => element.releasePointerCapture(Number(element.dataset.testPointer)));
  await page.mouse.move(box.x - 30, box.y + box.height / 2);
  await page.mouse.up();
  await expect(slider).toHaveAttribute('aria-valuenow', original);
  await expect(duration).toHaveText(committedDuration);
  expect(page.url()).toBe(url);
});

test('large trajectory keeps frame cadence while the selection follows the pointer', async ({ page }, testInfo) => {
  const fixture = require('../fixtures/minimal/triton.json');
  const first = Date.parse(fixture.window_start);
  const range = Date.parse(fixture.window_end) - first;
  const base = fixture.batches[0];
  const batches = Array.from({ length: 1600 }, (_, i) => ({
    ...base, id: 'motion-' + i, pr: 10000 + i,
    start_at: new Date(first + range * i / 1600).toISOString(),
    duration_seconds: 200 + i % 1200,
  }));
  await page.route('**/data/triton.json*', route => route.fulfill({ json: { ...fixture, batches } }));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('./#projects/triton/engineering');
  await page.getByRole('button', { name: '查看全部批次' }).click();
  await expect(page.locator('#triton-view .row')).toHaveCount(1600);
  const slider = page.getByRole('slider', { name: '时间范围起点' });
  await slider.scrollIntoViewIfNeeded();
  const box = await slider.boundingBox();
  const row = await page.locator('#triton-view .row').last().elementHandle();
  const idleFrames = await page.evaluate(async () => {
    const gaps = [];
    let last = await new Promise(requestAnimationFrame);
    for (let i = 0; i < 20; i++) {
      const now = await new Promise(requestAnimationFrame);
      gaps.push(now - last);
      last = now;
    }
    return gaps.sort((a, b) => a - b)[10];
  });
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  const timing = await page.evaluate(async () => {
    const nav = document.querySelector('#triton-view svg.nav-svg');
    const handle = nav.querySelector('[data-drag="start"]');
    const pointerId = Array.from({ length: 16 }, (_, i) => i + 1).find(id => nav.hasPointerCapture(id));
    if (pointerId === undefined) throw new Error('Navigator did not capture the pointer');
    const { left, width } = nav.getBoundingClientRect();
    const frames = [], work = [];
    let previous;
    for (let i = 0; i < 45; i++) {
      const stamp = await new Promise(requestAnimationFrame);
      if (previous !== undefined) frames.push(stamp - previous);
      previous = stamp;
      const start = performance.now();
      nav.dispatchEvent(new PointerEvent('pointermove', {
        pointerId, clientX: left + 10 + width * i / 90, bubbles: true,
      }));
      work.push(performance.now() - start);
    }
    const percentile = (values, percent) => values.sort((a, b) => a - b)[Math.floor(values.length * percent)];
    return { samples: frames.length, medianFrameMs: percentile(frames, .5),
      p95FrameMs: percentile(frames, .95), p95HandlerMs: percentile(work, .95),
      moved: Number(handle.getAttribute('x')) > 0 };
  });
  expect(await row.evaluate(element => element.isConnected)).toBe(true);
  await page.mouse.up();
  timing.idleMedianMs = idleFrames;
  await testInfo.attach('navigator-frame-timing', { body: JSON.stringify(timing), contentType: 'application/json' });
  console.log('Navigator, 1600 records:', JSON.stringify(timing));
  expect(timing.moved).toBe(true);
  expect(timing.p95HandlerMs).toBeLessThan(8);
});

test('the end handle and whole window use committed values after release', async ({ page }) => {
  await page.goto('./#projects/triton/engineering');
  await page.getByRole('button', { name: '24 小时', exact: true }).click();
  for (const name of ['时间范围终点', '时间范围整体窗口']) {
    const slider = page.getByRole('slider', { name });
    await slider.scrollIntoViewIfNeeded();
    const box = await slider.boundingBox();
    const original = Number(await slider.getAttribute('aria-valuenow'));
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 - 30, box.y + box.height / 2);
    await page.mouse.up();
    expect(Number(await slider.getAttribute('aria-valuenow'))).toBeLessThan(original);
  }
  const nav = page.locator('#triton-view svg.nav-svg');
  await nav.click({ position: { x: 12, y: 20 } });
  await expect(page.getByRole('slider', { name: '时间范围起点' })).toHaveAttribute(
    'aria-valuenow', String(Date.parse('2026-10-06T00:00:00Z')),
  );
});
