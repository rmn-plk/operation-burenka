import { chromium } from 'playwright-core';

const browser = await chromium.launch({
  headless: true,
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  args: ['--no-sandbox', '--enable-webgl', '--ignore-gpu-blocklist'],
});

async function rafSample(page, ms = 1200) {
  return page.evaluate(async (duration) => {
    let frames = 0;
    const start = performance.now();
    await new Promise((resolve) => {
      const tick = () => {
        frames += 1;
        if (performance.now() - start < duration) requestAnimationFrame(tick);
        else resolve();
      };
      requestAnimationFrame(tick);
    });
    return Number((frames / ((performance.now() - start) / 1000)).toFixed(1));
  }, ms);
}

const blank = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await blank.goto('data:text/html,<html><body style="background:#111"></body></html>');
await blank.waitForTimeout(500);
console.log('BLANK 1440x900:', await rafSample(blank));
await blank.close();

for (const [width, height] of [[1440, 900], [1024, 640], [720, 450]]) {
  const page = await browser.newPage({ viewport: { width, height } });
  await page.goto('http://127.0.0.1:5173/?debug=1', { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForFunction(() => window.__BURENKA_TEST__?.snapshot().mode === 'menu', null, { timeout: 30000 });
  await page.waitForTimeout(2200);
  const results = [];
  for (let i = 0; i < 2; i += 1) {
    results.push(await rafSample(page));
    await page.waitForTimeout(200);
  }
  console.log(`GAME ${width}x${height}:`, results);
  await page.close();
}

await browser.close();
