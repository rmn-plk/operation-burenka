import fs from 'node:fs';
import { chromium } from 'playwright-core';

fs.mkdirSync('artifacts', { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  args: ['--no-sandbox', '--enable-webgl', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(msg.text());
});
await page.goto('http://127.0.0.1:5173/?debug=1', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForFunction(() => window.__BURENKA_TEST__?.snapshot().mode === 'menu', null, { timeout: 30000 });
await page.waitForTimeout(1800);
await page.screenshot({ path: 'artifacts/10-menu-v2.png' });

await page.getByRole('button', { name: 'НАЧАТЬ ПОХИЩЕНИЕ' }).click();
await page.waitForTimeout(1200);
await page.screenshot({ path: 'artifacts/11-game-v2.png' });
await page.screenshot({ path: 'artifacts/11b-ufo-v2.png', clip: { x: 370, y: 130, width: 700, height: 520 } });

await page.evaluate(() => {
  const test = window.__BURENKA_TEST__;
  const state = test.snapshot();
  const target = state.cows.find((cow) => !cow.captured);
  if (target) test.teleport(target.x, target.z);
  test.setBeam(true);
});
await page.waitForTimeout(850);
await page.screenshot({ path: 'artifacts/12-beam-v2.png' });
await page.screenshot({ path: 'artifacts/12b-beam-closeup-v2.png', clip: { x: 400, y: 160, width: 660, height: 520 } });
console.log('BEAM SNAPSHOT:', JSON.stringify(await page.evaluate(() => {
  const s = window.__BURENKA_TEST__.snapshot();
  return {
    target: s.targetName,
    progress: s.targetProgress,
    energy: Math.round(s.energy),
    time: s.timeLeft,
    lifting: s.cows.find((cow) => cow.progress > 0),
  };
}), null, 2));
await page.evaluate(() => window.__BURENKA_TEST__.setBeam(false));
await page.waitForTimeout(700);
await page.keyboard.press('Escape');
await page.waitForTimeout(600);
await page.screenshot({ path: 'artifacts/13-pause-v2.png' });
console.log('ERRORS:', errors);
await browser.close();
