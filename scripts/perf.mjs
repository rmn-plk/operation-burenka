import { chromium } from 'playwright-core';

const browser = await chromium.launch({
  headless: true,
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  args: ['--no-sandbox', '--enable-webgl', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto('http://127.0.0.1:5173/?debug=1', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForFunction(() => window.__BURENKA_TEST__?.snapshot().mode === 'menu', null, { timeout: 30000 });
await page.waitForTimeout(3000);

async function sample(label) {
  const samples = [];
  for (let i = 0; i < 3; i += 1) {
    const fps = await page.evaluate(async () => {
      let frames = 0;
      const start = performance.now();
      await new Promise((resolve) => {
        const tick = () => {
          frames += 1;
          if (performance.now() - start < 1000) requestAnimationFrame(tick);
          else resolve();
        };
        requestAnimationFrame(tick);
      });
      return Number((frames / ((performance.now() - start) / 1000)).toFixed(1));
    });
    samples.push(fps);
    await page.waitForTimeout(200);
  }
  const sorted = [...samples].sort((a, b) => a - b);
  console.log(label, JSON.stringify(samples), 'median', sorted[1]);
}

await sample('MENU');
await page.getByRole('button', { name: 'НАЧАТЬ ПОХИЩЕНИЕ' }).click();
await page.waitForTimeout(1800);
await sample('PLAYING');
await page.evaluate(() => {
  const test = window.__BURENKA_TEST__;
  const state = test.snapshot();
  const cow = state.cows.find((item) => !item.captured);
  if (cow) test.teleport(cow.x, cow.z);
  test.setBeam(true);
});
await page.waitForTimeout(900);
await sample('BEAM');
const gl = await page.evaluate(() => {
  const gl = document.querySelector('canvas').getContext('webgl2');
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'unknown';
});
console.log('GL:', gl);
await browser.close();
