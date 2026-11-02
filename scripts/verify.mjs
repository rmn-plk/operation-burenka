import fs from 'node:fs';
import { chromium } from 'playwright-core';

const OUT = 'artifacts';
fs.mkdirSync(OUT, { recursive: true });

const chromePath = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const browser = await chromium.launch({
  headless: true,
  executablePath: chromePath,
  args: [
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--enable-webgl',
    '--ignore-gpu-blocklist',
    '--disable-features=Translate,MediaRouter',
  ],
});

const page = await browser.newPage({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
});

const consoleErrors = [];
const pageErrors = [];
const failedRequests = [];
const badResponses = [];
page.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push(msg.text());
});
page.on('pageerror', (error) => pageErrors.push(error.message));
page.on('response', (response) => {
  if (response.status() >= 400) badResponses.push(`${response.status()} ${response.url()}`);
});
page.on('requestfailed', (request) => {
  if (!request.url().includes('favicon')) failedRequests.push(`${request.url()} :: ${request.failure()?.errorText}`);
});

const test = (fn, arg) => page.evaluate(fn, arg);
const snap = () => page.evaluate(() => window.__BURENKA_TEST__.snapshot());

await page.goto('http://127.0.0.1:5173/?debug=1', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForFunction(
  () => window.__BURENKA_TEST__ && window.__BURENKA_TEST__.snapshot().mode === 'menu',
  null,
  { timeout: 30000 },
);
await page.waitForTimeout(1600);
const menuFps = await page.evaluate(async () => {
  let frames = 0;
  const start = performance.now();
  await new Promise((resolve) => {
    const tick = () => {
      frames += 1;
      if (performance.now() - start < 1500) requestAnimationFrame(tick);
      else resolve();
    };
    requestAnimationFrame(tick);
  });
  const gl = document.querySelector('canvas')?.getContext('webgl2');
  const ext = gl?.getExtension('WEBGL_debug_renderer_info');
  return {
    fps: Number((frames / ((performance.now() - start) / 1000)).toFixed(1)),
    renderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'unknown',
  };
});
console.log('RENDERER:', JSON.stringify(menuFps, null, 2));
await page.screenshot({ path: `${OUT}/01-menu.png` });
console.log('MENU SNAPSHOT:', JSON.stringify(await snap(), null, 2));

await page.getByRole('button', { name: 'НАЧАТЬ ПОХИЩЕНИЕ' }).click();
await page.waitForFunction(
  () => window.__BURENKA_TEST__.snapshot().mode === 'playing',
  null,
  { timeout: 10000 },
);
await page.waitForTimeout(1400);
await page.screenshot({ path: `${OUT}/02-game-start.png` });
await page.screenshot({ path: `${OUT}/02b-ufo-closeup.png`, clip: { x: 380, y: 140, width: 680, height: 500 } });

// Real pointer-driven abduction.
await page.mouse.move(760, 440);
await page.mouse.down();
await page.waitForTimeout(850);
await page.screenshot({ path: `${OUT}/03-beam-lifting.png` });
const midBeam = await snap();
console.log('MID-BEAM:', JSON.stringify({
  mode: midBeam.mode,
  beamVisible: midBeam.beamVisible,
  beamInput: midBeam.beamInput,
  target: midBeam.targetName,
  progress: midBeam.targetProgress,
  energy: midBeam.energy,
  liftingCow: midBeam.cows.find((cow) => cow.progress > 0),
}, null, 2));

await page.waitForTimeout(1600);
await page.mouse.up();
await page.waitForTimeout(600);
await page.screenshot({ path: `${OUT}/04-after-abduction.png` });
const afterAbduction = await snap();
console.log('AFTER ABDUCTION:', JSON.stringify({
  mode: afterAbduction.mode,
  collected: afterAbduction.collected,
  score: afterAbduction.score,
  combo: afterAbduction.combo,
  energy: Math.round(afterAbduction.energy),
  cows: afterAbduction.cows.filter((cow) => cow.captured).map((cow) => cow.name),
}, null, 2));

// Movement + pause / resume.
const beforeMove = await snap();
await page.keyboard.down('a');
await page.keyboard.down('w');
await page.waitForTimeout(650);
await page.keyboard.up('a');
await page.keyboard.up('w');
await page.waitForTimeout(350);
const afterMove = await snap();
console.log('MOVEMENT:', JSON.stringify({ before: beforeMove.ship, after: afterMove.ship }, null, 2));

await page.keyboard.press('Escape');
await page.waitForTimeout(500);
const pauseVisible = await page.locator('.pause-layer').isVisible();
console.log('PAUSE VISIBLE:', pauseVisible);
await page.screenshot({ path: `${OUT}/05-pause.png` });
await page.getByRole('button', { name: 'ПРОДОЛЖИТЬ' }).click();
await page.waitForTimeout(500);
console.log('RESUMED MODE:', (await snap()).mode);

// Restart and complete the mission through the real capture loop.
await page.evaluate(() => window.__BURENKA_TEST__.start());
await page.waitForTimeout(900);
let guard = 0;
while (guard < 20) {
  guard += 1;
  const state = await snap();
  if (state.mode !== 'playing') break;
  if (state.collected >= 8) break;
  if (state.energy < 58) {
    await page.waitForTimeout(900);
    continue;
  }
  const target = state.cows.find((cow) => !cow.captured);
  if (!target) break;
  const before = state.collected;
  await page.evaluate(({ x, z }) => {
    window.__BURENKA_TEST__.teleport(x, z);
    window.__BURENKA_TEST__.setBeam(true);
  }, { x: target.x, z: target.z });
  try {
    await page.waitForFunction(
      (count) => {
        const current = window.__BURENKA_TEST__.snapshot();
        return current.collected > count || current.mode !== 'playing';
      },
      before,
      { timeout: 7000 },
    );
  } catch (error) {
    console.log('CAPTURE WAIT TIMEOUT:', error.message);
  }
  await page.evaluate(() => window.__BURENKA_TEST__.setBeam(false));
  await page.waitForTimeout(350);
  const progressState = await snap();
  console.log(`CAPTURE ${progressState.collected}/8 — ${target.name}; energy=${Math.round(progressState.energy)}; mode=${progressState.mode}`);
  if (progressState.mode !== 'playing') break;
}

await page.waitForFunction(
  () => ['won', 'lost'].includes(window.__BURENKA_TEST__.snapshot().mode),
  null,
  { timeout: 20000 },
).catch(() => {});
await page.waitForTimeout(1500);
const finalState = await snap();
console.log('FINAL:', JSON.stringify({
  mode: finalState.mode,
  collected: finalState.collected,
  score: finalState.score,
  timeLeft: Math.round(finalState.timeLeft),
  energy: Math.round(finalState.energy),
}, null, 2));
const endVisible = await page.locator('.end-card').isVisible().catch(() => false);
console.log('END CARD VISIBLE:', endVisible);
if (endVisible) {
  await page.screenshot({ path: `${OUT}/06-game-end.png` });
}
if (await page.locator('.end-card.won').isVisible().catch(() => false)) {
  await page.getByRole('button', { name: 'В МЕНЮ' }).click();
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${OUT}/07-back-to-menu.png` });
}

// Loss state / overlay.
await page.getByRole('button', { name: 'НАЧАТЬ ПОХИЩЕНИЕ' }).click();
await page.waitForTimeout(700);
await page.evaluate(() => window.__BURENKA_TEST__.lose());
await page.waitForTimeout(1200);
const lostState = await snap();
console.log('LOST STATE:', JSON.stringify({ mode: lostState.mode, collected: lostState.collected, score: lostState.score }, null, 2));
const lostOverlay = await page.locator('.end-card.lost').isVisible().catch(() => false);
console.log('LOST OVERLAY VISIBLE:', lostOverlay);
if (lostOverlay) await page.screenshot({ path: `${OUT}/07b-lost.png` });
if (lostOverlay) {
  await page.getByRole('button', { name: 'В МЕНЮ' }).click();
  await page.waitForTimeout(600);
}

// Mobile layout / touch controls.
const mobile = await browser.newPage({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 1,
  isMobile: true,
  hasTouch: true,
});
const mobileErrors = [];
mobile.on('pageerror', (error) => mobileErrors.push(error.message));
await mobile.goto('http://127.0.0.1:5173/?debug=1', { waitUntil: 'networkidle', timeout: 60000 });
await mobile.waitForFunction(
  () => window.__BURENKA_TEST__ && window.__BURENKA_TEST__.snapshot().mode === 'menu',
  null,
  { timeout: 30000 },
);
await mobile.waitForTimeout(1200);
await mobile.screenshot({ path: `${OUT}/08-mobile-menu.png` });
await mobile.getByRole('button', { name: 'НАЧАТЬ ПОХИЩЕНИЕ' }).click();
await mobile.waitForTimeout(1100);
await mobile.screenshot({ path: `${OUT}/09-mobile-game.png` });
const touchControlsVisible = await mobile.locator('.touch-controls').isVisible().catch(() => false);
await mobile.locator('.touch-beam').dispatchEvent('pointerdown', {
  pointerId: 31,
  pointerType: 'touch',
  isPrimary: true,
  bubbles: true,
});
await mobile.waitForTimeout(900);
const mobileBeamState = await mobile.evaluate(() => window.__BURENKA_TEST__.snapshot());
await mobile.screenshot({ path: `${OUT}/09b-mobile-beam.png` });
await mobile.locator('.touch-beam').dispatchEvent('pointerup', {
  pointerId: 31,
  pointerType: 'touch',
  isPrimary: true,
  bubbles: true,
});
console.log('MOBILE TOUCH CONTROLS:', touchControlsVisible, 'BEAM:', JSON.stringify({
  target: mobileBeamState.targetName,
  progress: Number(mobileBeamState.targetProgress.toFixed(2)),
  energy: Math.round(mobileBeamState.energy),
  beamInput: mobileBeamState.beamInput,
}), 'ERRORS:', mobileErrors);

console.log('CONSOLE ERRORS:', JSON.stringify(consoleErrors, null, 2));
console.log('PAGE ERRORS:', JSON.stringify(pageErrors, null, 2));
console.log('FAILED REQUESTS:', JSON.stringify(failedRequests, null, 2));
console.log('BAD RESPONSES:', JSON.stringify(badResponses, null, 2));

await browser.close();

if (consoleErrors.length || pageErrors.length || mobileErrors.length) {
  process.exitCode = 2;
}
