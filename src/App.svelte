<script>
  import { onMount } from 'svelte';
  import { UFOAbductionGame } from './lib/game/UFOAbductionGame.js';
  import CowIcon from './lib/components/CowIcon.svelte';
  import UfoIcon from './lib/components/UfoIcon.svelte';
  import AlienIcon from './lib/components/AlienIcon.svelte';

  const DEFAULT_HUD = {
    phase: 'loading',
    timeLeft: 80,
    timeLabel: '01:20',
    duration: 80,
    collected: 0,
    quota: 8,
    score: 0,
    best: 0,
    combo: 1,
    comboTimer: 0,
    comboWindow: 4.5,
    energy: 100,
    overheated: false,
    beamActive: false,
    beamPulling: false,
    targetName: '',
    targetProgress: 0,
    targetLocked: false,
    message: 'ИЩЕМ КОРОВУ',
    hint: 'Подлетай ближе к стаду',
    muted: false,
    totalCows: 10,
  };

  let canvas;
  let game = null;
  let phase = $state('loading');
  let hud = $state({ ...DEFAULT_HUD });
  let initError = $state('');
  let touchMode = $state(false);
  let helpOpen = $state(false);
  let toasts = $state([]);
  let toastId = 0;
  let toastTimers = [];
  let flashKind = $state('');
  let flashKey = $state(0);
  let flashTimer = null;
  let beamHeld = $state(false);
  let destroyed = false;

  const quotaSlots = $derived(Array.from({ length: hud.quota || 8 }, (_, index) => index));
  const energyPct = $derived(Math.max(0, Math.min(100, Math.round(hud.energy))));
  const capturePct = $derived(Math.max(0, Math.min(100, Math.round((hud.targetProgress || 0) * 100))));
  const timePct = $derived(hud.duration ? Math.max(0, Math.min(100, (hud.timeLeft / hud.duration) * 100)) : 0);
  const comboPct = $derived(hud.comboWindow ? Math.max(0, Math.min(100, (hud.comboTimer / hud.comboWindow) * 100)) : 0);
  const scoreLabel = $derived((hud.score || 0).toLocaleString('ru-RU'));
  const bestLabel = $derived(hud.best > 0 ? hud.best.toLocaleString('ru-RU') : '—');
  const isUrgent = $derived(phase === 'playing' && hud.timeLeft <= 15);
  const isTouch = $derived(touchMode);

  onMount(() => {
    try {
      touchMode = window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
      game = new UFOAbductionGame(canvas, {
        onReady: () => {
          if (!destroyed) phase = 'menu';
        },
        onUpdate: (data) => {
          if (destroyed) return;
          hud = data;
          phase = data.phase;
        },
        onEvent: handleGameEvent,
      });
    } catch (error) {
      console.error(error);
      initError = error?.message || 'Не удалось запустить WebGL';
      phase = 'error';
    }

    return () => {
      destroyed = true;
      toastTimers.forEach((timer) => clearTimeout(timer));
      if (flashTimer) clearTimeout(flashTimer);
      game?.destroy();
    };
  });

  function handleGameEvent(event) {
    if (!event || !event.type) return;
    if (event.type === 'start') {
      toasts = [];
      addToast('МИССИЯ НАЧАЛАСЬ · НЕ ШУМИ', 'info');
      helpOpen = false;
    } else if (event.type === 'abduct') {
      const badge = event.combo > 1 ? `КОМБО ×${event.combo}` : '';
      addToast(`${event.cow.toUpperCase()} НА БОРТУ · +${event.points}`, 'success', badge);
      triggerFlash('pink');
    } else if (event.type === 'overheat') {
      addToast('ЛУЧ ПЕРЕГРЕТСЯ · ОХЛАЖДАЕМ', 'warning');
      triggerFlash('warning');
    } else if (event.type === 'ready') {
      addToast('ЛУЧ СНОВА ГОТОВ', 'mint');
    } else if (event.type === 'won') {
      triggerFlash('mint');
    } else if (event.type === 'lost') {
      triggerFlash('warning');
    } else if (event.type === 'menu') {
      toasts = [];
      helpOpen = false;
    }
  }

  function addToast(text, tone = 'info', badge = '') {
    const id = ++toastId;
    toasts = [...toasts.slice(-2), { id, text, tone, badge }];
    const timer = setTimeout(() => {
      toasts = toasts.filter((toast) => toast.id !== id);
    }, 3200);
    toastTimers.push(timer);
  }

  function triggerFlash(kind) {
    flashKey += 1;
    flashKind = kind;
    if (flashTimer) clearTimeout(flashTimer);
    flashTimer = setTimeout(() => {
      flashKind = '';
    }, 460);
  }

  function startGame() {
    if (!game) return;
    helpOpen = false;
    game.start();
  }

  function restartGame() {
    if (!game) return;
    helpOpen = false;
    game.start();
  }

  function backToMenu() {
    if (!game) return;
    helpOpen = false;
    game.toMenu();
  }

  function togglePause() {
    game?.togglePause();
  }

  function toggleMute() {
    game?.toggleMute();
  }

  function toggleHelp() {
    helpOpen = !helpOpen;
  }

  function moveTouch(x, z) {
    game?.setVirtualMove(x, z);
  }

  function stopTouchMove() {
    game?.setVirtualMove(0, 0);
  }

  function pressBeam(event) {
    event.preventDefault();
    if (!game || phase !== 'playing') return;
    game.setVirtualBeam(true);
    beamHeld = true;
  }

  function releaseBeam() {
    if (!game) return;
    game.setVirtualBeam(false);
    beamHeld = false;
  }

  function releaseAll() {
    stopTouchMove();
    releaseBeam();
  }
</script>

<svelte:window onpointerup={releaseAll} onpointercancel={releaseAll} />

<main class="game-shell" class:is-touch={isTouch} class:is-playing={phase === 'playing'}>
  <canvas bind:this={canvas} class="scene" aria-label="Воксельная ферма и летающая тарелка"></canvas>

  <div class="scene-grade" aria-hidden="true"></div>
  <div class="frame-corners" aria-hidden="true">
    <span></span><span></span><span></span><span></span>
  </div>

  {#if phase === 'loading'}
    <div class="loading-screen">
      <div class="loader-mark">
        <div class="loader-beam"></div>
        <UfoIcon size={76} />
      </div>
      <div class="loader-title">ОПЕРАЦИЯ «БУРЁНКА»</div>
      <div class="loader-text">ПРОГРЕВАЕМ ТРАКТОРНЫЙ ЛУЧ<span class="loader-dots">...</span></div>
      <div class="loader-track"><div></div></div>
      <div class="loader-note">X-FILES FARM · НОЧНАЯ СМЕНА · 02:47</div>
    </div>
  {/if}

  {#if phase === 'error'}
    <div class="error-screen">
      <div class="modal-card error-card">
        <span class="kicker">СБОЙ СИГНАЛА</span>
        <h2>WebGL не отвечает</h2>
        <p>{initError}</p>
        <p class="muted">Попробуй другой браузер или включи аппаратное ускорение.</p>
      </div>
    </div>
  {/if}

  {#if phase === 'menu'}
    <section class="menu-screen" aria-label="Главное меню">
      <div class="menu-scrim" aria-hidden="true"></div>

      <header class="menu-top">
        <div class="menu-brand">
          <UfoIcon size={30} />
          <span>X-FILES FARM</span>
          <i></i>
          <span class="hide-small">НОЧНАЯ СМЕНА</span>
        </div>
        <div class="menu-top-actions">
          <span class="menu-time">02:47</span>
          <button class="icon-btn" type="button" onclick={toggleMute} aria-label={hud.muted ? 'Включить звук' : 'Выключить звук'} title={hud.muted ? 'Включить звук' : 'Выключить звук'}>
            {#if hud.muted}
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M11 5 6.5 9H3v6h3.5L11 19V5Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="m16 9 5 6M21 9l-5 6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>
            {:else}
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M11 5 6.5 9H3v6h3.5L11 19V5Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M15 9.2a4 4 0 0 1 0 5.6M18 6.5a8 8 0 0 1 0 11" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>
            {/if}
          </button>
        </div>
      </header>

      <div class="menu-content">
        <div class="kicker menu-kicker">
          <span class="live-dot"></span>
          СЕКРЕТНАЯ ОПЕРАЦИЯ · СЕКТОР 51
        </div>

        <h1 class="menu-title">
          <span class="title-eyebrow">ОПЕРАЦИЯ</span>
          <span class="title-main"><span class="title-quote">«</span>БУРЁНКА<span class="title-quote">»</span></span>
        </h1>

        <p class="menu-lead">
          Зелёные человечки проголодались. Ты — пилот тарелки на задании:
          <strong>похитить 8 коров</strong> с воксельной фермы тракторным лучом,
          пока фермер не проснулся и не увидел НЛО над кукурузой.
        </p>

        <div class="mission-facts">
          <div class="fact">
            <span class="fact-icon"><CowIcon active size={24} /></span>
            <span class="fact-copy"><small>ЦЕЛЬ</small><b>8 КОРОВ</b></span>
          </div>
          <div class="fact">
            <span class="fact-icon">
              <svg width="23" height="23" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="13" r="7.2" stroke="currentColor" stroke-width="1.7"/><path d="M12 9v4.5l2.8 1.7M9.5 3h5M12 3v2.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>
            </span>
            <span class="fact-copy"><small>ДО РАССВЕТА</small><b>80 СЕК</b></span>
          </div>
          <div class="fact">
            <span class="fact-icon"><UfoIcon size={25} /></span>
            <span class="fact-copy"><small>ИНСТРУМЕНТ</small><b>ЛУЧ 01</b></span>
          </div>
        </div>

        <div class="menu-cta-row">
          <button class="primary-btn" type="button" onclick={startGame}>
            <span>НАЧАТЬ ПОХИЩЕНИЕ</span>
            <span class="btn-arrow" aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M4 12h15M13 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </span>
          </button>
          <button class="ghost-btn" type="button" onclick={toggleHelp}>КАК ИГРАТЬ</button>
        </div>

        {#if isTouch}
          <div class="menu-controls touch-note">
            <span class="controls-label">УПРАВЛЕНИЕ</span>
            <span>СЕНСОРНЫЕ КНОПКИ ПОЯВЯТСЯ В ИГРЕ</span>
          </div>
        {:else}
          <div class="menu-controls">
            <span class="controls-label">УПРАВЛЕНИЕ</span>
            <span class="key-combo"><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> ПОЛЁТ</span>
            <span class="key-combo"><kbd>ЛКМ</kbd> / <kbd>ПРОБЕЛ</kbd> ЛУЧ</span>
            <span class="key-combo"><kbd>ESC</kbd> ПАУЗА</span>
          </div>
        {/if}

        <p class="menu-note"><span>✦</span> Рекорд станции: {bestLabel} очков. Экипаж уверен, что «му» — древний межгалактический.</p>
      </div>

      <aside class="menu-side" aria-label="Сводка наблюдения">
        <div class="side-head">
          <span><span class="live-dot"></span> СВОДКА</span>
          <span class="side-code">FILE 001</span>
        </div>
        <div class="side-row"><span>ОБЪЕКТ</span><b>ФЕРМА «X-FILES»</b></div>
        <div class="side-row"><span>СТАДО</span><b>10 ГОЛОВ</b></div>
        <div class="side-row"><span>СТАТУС</span><b class="pink-text">ЛЁГКАЯ ПАНИКА</b></div>
        <div class="side-row"><span>ЭКИПАЖ</span><b class="mint-text">3 ЗЕЛЁНЫХ</b></div>
        <div class="side-row"><span>ЯЗЫК</span><b>«МУ»</b></div>
        <div class="side-aliens">
          <AlienIcon size={38} />
          <AlienIcon size={46} />
          <AlienIcon size={36} />
          <span>ЭКИПАЖ НА СВЯЗИ</span>
        </div>
        <div class="barcode" aria-hidden="true"></div>
        <div class="side-foot">ШТАТ ОГАЙО · 02:47 · ВИДИМОСТЬ 97%</div>
        <div class="classified-stamp">СОВЕРШЕННО<br />СЕКРЕТНО</div>
      </aside>

      <footer class="menu-footer">
        <div class="ticker">
          <div>
            ФЕРМА X-FILES · ПОЛЕ №7 · ШТАТ ОГАЙО · 02:47 · НЛО ПОДТВЕРЖДЕНО · КОРОВЫ НЕРВНИЧАЮТ · СВЯЗЬ С ЗЕМЛЁЙ НЕСТАБИЛЬНА ·
            ФЕРМА X-FILES · ПОЛЕ №7 · ШТАТ ОГАЙО · 02:47 · НЛО ПОДТВЕРЖДЕНО
          </div>
        </div>
        <span class="build-tag">THREE.JS × SVELTE · V1.0</span>
      </footer>
    </section>
  {/if}

  {#if phase === 'playing' || phase === 'paused' || phase === 'won' || phase === 'lost'}
    <div class="hud" aria-label="Игровой интерфейс">
      <header class="topbar">
        <div class="brand-card">
          <div class="brand-mark"><UfoIcon size={28} /></div>
          <div class="brand-copy">
            <span class="eyebrow">X-FILES FARM · 02:47</span>
            <strong>ОПЕРАЦИЯ «БУРЁНКА»</strong>
          </div>
        </div>

        <div class="timer-card" class:urgent={isUrgent}>
          <span class="eyebrow">ДО РАССВЕТА</span>
          <div class="timer-value">{hud.timeLabel}</div>
          <div class="timer-track"><div style="width: {timePct}%"></div></div>
        </div>

        <div class="top-right">
          <div class="quota-card">
            <div class="quota-head">
              <span class="eyebrow">НА БОРТУ</span>
              <strong>{hud.collected}<em>/{hud.quota}</em></strong>
            </div>
            <div class="cow-slots">
              {#each quotaSlots as index (index)}
                <span class="cow-slot" class:filled={index < hud.collected}>
                  <CowIcon active={index < hud.collected} size={19} />
                </span>
              {/each}
            </div>
          </div>
          <div class="hud-buttons">
            <button class="icon-btn" type="button" onclick={toggleMute} aria-label={hud.muted ? 'Включить звук' : 'Выключить звук'} title="Звук">
              {#if hud.muted}
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M11 5 6.5 9H3v6h3.5L11 19V5Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="m16 9 5 6M21 9l-5 6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>
              {:else}
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M11 5 6.5 9H3v6h3.5L11 19V5Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M15 9.2a4 4 0 0 1 0 5.6M18 6.5a8 8 0 0 1 0 11" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>
              {/if}
            </button>
            <button class="icon-btn" type="button" onclick={togglePause} aria-label="Пауза" title="Пауза">
              {#if phase === 'paused'}
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M7 4.5v15l12-7.5-12-7.5Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>
              {:else}
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M8 5v14M16 5v14" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>
              {/if}
            </button>
          </div>
        </div>
      </header>

      <aside class="hud-side">
        <div class="score-card">
          <span class="eyebrow">ОЧКИ</span>
          <strong>{scoreLabel}</strong>
          <small>РЕКОРД · {bestLabel}</small>
        </div>
        {#if hud.combo > 1}
          <div class="combo-card">
            <div class="combo-copy"><span>КОМБО</span><strong>×{hud.combo}</strong></div>
            <div class="combo-track"><div style="width: {comboPct}%"></div></div>
          </div>
        {/if}
      </aside>

      <div class="hud-bottom">
        <div class="beam-card" class:is-empty={hud.energy < 20} class:is-hot={hud.overheated}>
          <div class="beam-head">
            <span class="beam-label"><i class="status-dot" class:active={Boolean(hud.targetName)}></i> ТРАКТОРНЫЙ ЛУЧ</span>
            <span class="beam-message" class:warning={hud.overheated}>{hud.message}</span>
          </div>
          <div class="energy-row">
            <span class="energy-label">ЭНЕРГИЯ</span>
            <div class="energy-track">
              <div class="energy-fill" style="width: {energyPct}%"></div>
              <div class="energy-ticks" aria-hidden="true"></div>
            </div>
            <b class="energy-value">{energyPct}%</b>
          </div>
          <div class="capture-row" class:has-target={Boolean(hud.targetName)}>
            <span class="capture-name">{hud.targetName ? hud.targetName.toUpperCase() : 'ЦЕЛЬ НЕ НАЙДЕНА'}</span>
            <div class="capture-track"><div class="capture-fill" style="width: {capturePct}%"></div></div>
            <strong>{capturePct}%</strong>
          </div>
          <div class="beam-hint">{hud.hint}</div>
        </div>
      </div>

      <div class="controls-hint">
        <span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd></span>
        <span><kbd>ЛКМ</kbd> ЛУЧ</span>
        <span><kbd>ESC</kbd> ПАУЗА</span>
      </div>

      {#if isTouch && phase === 'playing'}
        <div class="touch-controls">
          <div class="dpad">
            <button class="touch-btn dpad-up" type="button" aria-label="Вверх" onpointerdown={(event) => { event.preventDefault(); moveTouch(0, -1); }} onpointerup={stopTouchMove} onpointerleave={stopTouchMove} onpointercancel={stopTouchMove}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m5 15 7-7 7 7" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>
            <button class="touch-btn dpad-left" type="button" aria-label="Влево" onpointerdown={(event) => { event.preventDefault(); moveTouch(-1, 0); }} onpointerup={stopTouchMove} onpointerleave={stopTouchMove} onpointercancel={stopTouchMove}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m15 5-7 7 7 7" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>
            <button class="touch-btn dpad-right" type="button" aria-label="Вправо" onpointerdown={(event) => { event.preventDefault(); moveTouch(1, 0); }} onpointerup={stopTouchMove} onpointerleave={stopTouchMove} onpointercancel={stopTouchMove}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m9 5 7 7-7 7" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>
            <button class="touch-btn dpad-down" type="button" aria-label="Вниз" onpointerdown={(event) => { event.preventDefault(); moveTouch(0, 1); }} onpointerup={stopTouchMove} onpointerleave={stopTouchMove} onpointercancel={stopTouchMove}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m5 9 7 7 7-7" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>
          </div>
          <button
            class="touch-beam"
            class:held={beamHeld}
            type="button"
            aria-label="Тракторный луч"
            onpointerdown={pressBeam}
            onpointerup={releaseBeam}
            onpointerleave={releaseBeam}
            onpointercancel={releaseBeam}
          >
            <UfoIcon size={28} />
            <span>ЛУЧ</span>
          </button>
        </div>
      {/if}
    </div>
  {/if}

  {#if toasts.length > 0 && phase !== 'menu' && phase !== 'loading'}
    <div class="toast-wrap" aria-live="polite">
      {#each toasts as toast (toast.id)}
        <div class="toast toast-{toast.tone}">
          <i></i>
          <span>{toast.text}</span>
          {#if toast.badge}<b>{toast.badge}</b>{/if}
        </div>
      {/each}
    </div>
  {/if}

  {#if phase === 'paused'}
    <div class="modal-layer pause-layer">
      <div class="modal-card pause-card">
        <span class="kicker">СИГНАЛ ПРИОСТАНОВЛЕН</span>
        <div class="pause-mark"><UfoIcon size={54} /></div>
        <h2>ПАУЗА</h2>
        <p>Коровы ждут. Зелёные человечки — тоже.</p>
        <div class="modal-actions">
          <button class="primary-btn" type="button" onclick={() => game?.resume()}>
            <span>ПРОДОЛЖИТЬ</span>
            <span class="btn-arrow" aria-hidden="true"><svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M4 12h15M13 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
          </button>
          <button class="ghost-btn" type="button" onclick={restartGame}>ЗАНОВО</button>
        </div>
        <button class="link-btn" type="button" onclick={toggleHelp}>УПРАВЛЕНИЕ И ПРАВИЛА</button>
      </div>
    </div>
  {/if}

  {#if phase === 'won' || phase === 'lost'}
    <div class="modal-layer end-layer">
      <div class="end-card" class:won={phase === 'won'} class:lost={phase === 'lost'}>
        <div class="end-accent" aria-hidden="true"></div>
        <div class="end-mark">
          {#if phase === 'won'}<AlienIcon size={58} />{:else}<CowIcon active size={58} />{/if}
        </div>
        <span class="kicker">{phase === 'won' ? 'ОТЧЁТ ЭКИПАЖА · УСПЕХ' : 'ОТЧЁТ ЭКИПАЖА · ПРОВАЛ'}</span>
        <h2>{phase === 'won' ? 'МУ-ССИЯ ВЫПОЛНЕНА' : 'ФЕРМА ПРОСНУЛАСЬ'}</h2>
        <p class="end-lead">
          {#if phase === 'won'}
            Восемь коров на борту, кукуруза цела, фермер ничего не заметил. Экипаж требует добавки.
          {:else}
            Солнце поднялось над полем, а в трюме всё ещё пусто. Зелёные человечки грустят и ждут ещё одну попытку.
          {/if}
        </p>
        <div class="end-stats">
          <div><span>КОРОВЫ</span><strong>{hud.collected}<em>/{hud.quota}</em></strong></div>
          <div><span>ОЧКИ</span><strong>{scoreLabel}</strong></div>
          <div><span>РЕКОРД</span><strong>{bestLabel}</strong></div>
        </div>
        <div class="end-actions">
          <button class="primary-btn" type="button" onclick={restartGame}>
            <span>{phase === 'won' ? 'ЕЩЁ РЕЙД' : 'ПОПРОБОВАТЬ СНОВА'}</span>
            <span class="btn-arrow" aria-hidden="true"><svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M4 12h15M13 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
          </button>
          <button class="ghost-btn" type="button" onclick={backToMenu}>В МЕНЮ</button>
        </div>
        <p class="end-flavor">{phase === 'won' ? '★ Сливки, молоко и немного похищенного сена уже в трюме.' : 'Совет экипажа: не отпускай луч и следи за энергией.'}</p>
      </div>
    </div>
  {/if}

  {#if helpOpen}
    <div class="modal-layer help-layer">
      <div class="modal-card help-card">
        <div class="help-head">
          <div>
            <span class="kicker">ИНСТРУКЦИЯ ДЛЯ ПИЛОТА</span>
            <h2>КАК ПОХИТИТЬ КОРОВУ</h2>
          </div>
          <button class="icon-btn" type="button" onclick={toggleHelp} aria-label="Закрыть инструкцию">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
          </button>
        </div>
        <div class="help-list">
          <div class="help-row">
            <span class="help-num">01</span>
            <div><b>ЛЕТИ НАД СТАДОМ</b><p>WASD или стрелки двигают тарелку над полем. Коровы пугаются и разбегаются — не зевай.</p></div>
            <span class="help-key"><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd></span>
          </div>
          <div class="help-row">
            <span class="help-num">02</span>
            <div><b>ДЕРЖИ ТРАКТОРНЫЙ ЛУЧ</b><p>Зажми ЛКМ или ПРОБЕЛ, чтобы захватить ближайшую корову. Держи луч 1,75 секунды, пока она не окажется на борту.</p></div>
            <span class="help-key"><kbd>ЛКМ</kbd><kbd>ПРОБЕЛ</kbd></span>
          </div>
          <div class="help-row">
            <span class="help-num">03</span>
            <div><b>СЛЕДИ ЗА ЭНЕРГИЕЙ</b><p>Луч расходует заряд. Если шкала опустеет, излучатель перегреется и отключится на пару секунд.</p></div>
            <span class="help-key"><span class="mini-energy"><i></i></span></span>
          </div>
          <div class="help-row">
            <span class="help-num">04</span>
            <div><b>СОБИРАЙ КОМБО</b><p>Похищай коров одну за другой, чтобы поднять множитель до ×5 и заработать больше очков.</p></div>
            <span class="help-key"><b class="combo-chip">×5</b></span>
          </div>
        </div>
        <div class="help-goal">
          <CowIcon active size={26} />
          <p>Цель: <b>8 коров</b> за <b>80 секунд</b>. Удачи, землянин.</p>
        </div>
        <button class="primary-btn wide" type="button" onclick={toggleHelp}>
          <span>ПОНЯТНО, ЛЕТИМ</span>
          <span class="btn-arrow" aria-hidden="true"><svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M4 12h15M13 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
        </button>
      </div>
    </div>
  {/if}

  {#if flashKind}
    {#key flashKey}
      <div class="screen-flash flash-{flashKind}" aria-hidden="true"></div>
    {/key}
  {/if}
</main>

<style>
  .game-shell {
    position: fixed;
    inset: 0;
    overflow: hidden;
    background: #08050f;
    isolation: isolate;
  }

  .scene {
    position: absolute;
    inset: 0;
    display: block;
    width: 100%;
    height: 100%;
    outline: none;
    z-index: 0;
  }

  .is-playing .scene {
    cursor: crosshair;
  }

  .scene-grade {
    position: absolute;
    inset: 0;
    z-index: 2;
    pointer-events: none;
    background:
      radial-gradient(ellipse at 50% 47%, transparent 39%, rgba(3, 2, 9, 0.34) 78%, rgba(3, 2, 9, 0.7) 100%),
      linear-gradient(180deg, rgba(3, 2, 9, 0.5) 0%, transparent 13%, transparent 72%, rgba(3, 2, 9, 0.52) 100%);
  }

  .scene-grade::before {
    content: '';
    position: absolute;
    inset: 0;
    opacity: 0.19;
    background-image: repeating-linear-gradient(to bottom, rgba(0, 0, 0, 0.2) 0, rgba(0, 0, 0, 0.2) 1px, transparent 1px, transparent 3px);
    mix-blend-mode: multiply;
  }

  .scene-grade::after {
    content: '';
    position: absolute;
    inset: 0;
    opacity: 0.055;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 180 180' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.7'/%3E%3C/svg%3E");
    mix-blend-mode: screen;
  }

  .frame-corners {
    position: absolute;
    inset: 18px;
    z-index: 3;
    pointer-events: none;
  }

  .frame-corners span {
    position: absolute;
    width: 19px;
    height: 19px;
    border-color: rgba(246, 237, 218, 0.2);
    border-style: solid;
  }

  .frame-corners span:nth-child(1) { top: 0; left: 0; border-width: 1px 0 0 1px; }
  .frame-corners span:nth-child(2) { top: 0; right: 0; border-width: 1px 1px 0 0; }
  .frame-corners span:nth-child(3) { bottom: 0; left: 0; border-width: 0 0 1px 1px; }
  .frame-corners span:nth-child(4) { bottom: 0; right: 0; border-width: 0 1px 1px 0; }

  .eyebrow,
  .kicker,
  .controls-label {
    font-family: var(--display);
    font-weight: 400;
    font-size: 9px;
    line-height: 1.3;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--muted);
  }

  .kicker {
    display: inline-flex;
    align-items: center;
    gap: 9px;
    font-size: 10px;
    letter-spacing: 0.18em;
    color: #d4c9e3;
  }

  .live-dot {
    display: inline-block;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--pink);
    box-shadow: 0 0 0 4px rgba(255, 95, 216, 0.13), 0 0 14px rgba(255, 95, 216, 0.7);
    animation: live-pulse 2.2s ease-in-out infinite;
  }

  @keyframes live-pulse {
    0%, 100% { opacity: 0.55; transform: scale(0.85); }
    50% { opacity: 1; transform: scale(1); }
  }

  .icon-btn {
    display: grid;
    place-items: center;
    width: 40px;
    height: 40px;
    border-radius: 12px;
    border: 1px solid var(--line);
    background: rgba(20, 13, 34, 0.64);
    color: rgba(246, 237, 218, 0.82);
    backdrop-filter: blur(12px);
    transition: color 160ms ease, border-color 160ms ease, background 160ms ease, transform 160ms ease;
    pointer-events: auto;
  }

  .icon-btn:hover {
    color: var(--pink-soft);
    border-color: rgba(255, 95, 216, 0.5);
    background: rgba(30, 17, 45, 0.86);
    transform: translateY(-1px);
  }

  .icon-btn:active {
    transform: translateY(0) scale(0.96);
  }

  /* ------------------------------------------------------------------ */
  /*  Menu                                                              */
  /* ------------------------------------------------------------------ */

  .menu-screen {
    position: absolute;
    inset: 0;
    z-index: 20;
    display: flex;
    flex-direction: column;
    min-height: 100svh;
    padding: 22px clamp(22px, 5.4vw, 88px) 22px;
    overflow-y: auto;
    overflow-x: hidden;
    scrollbar-width: thin;
    scrollbar-color: rgba(255, 95, 216, 0.4) transparent;
  }

  .menu-scrim {
    position: fixed;
    inset: 0;
    z-index: -1;
    pointer-events: none;
    background:
      linear-gradient(90deg, rgba(7, 4, 14, 0.96) 0%, rgba(7, 4, 14, 0.84) 30%, rgba(7, 4, 14, 0.42) 55%, rgba(7, 4, 14, 0) 78%),
      linear-gradient(0deg, rgba(7, 4, 14, 0.9) 0%, transparent 32%),
      linear-gradient(180deg, rgba(7, 4, 14, 0.64) 0%, transparent 18%);
  }

  .menu-top {
    position: relative;
    z-index: 3;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 24px;
  }

  .menu-brand {
    display: flex;
    align-items: center;
    gap: 11px;
    color: #cdbfe0;
    font-family: var(--display);
    font-size: 10px;
    letter-spacing: 0.2em;
    text-transform: uppercase;
  }

  .menu-brand :global(svg) {
    color: var(--mint);
    filter: drop-shadow(0 0 10px rgba(130, 255, 211, 0.3));
  }

  .menu-brand i {
    display: block;
    width: 28px;
    height: 1px;
    background: rgba(246, 237, 218, 0.22);
  }

  .menu-top-actions {
    display: flex;
    align-items: center;
    gap: 14px;
  }

  .menu-time {
    color: var(--pink-soft);
    font-family: var(--display);
    font-size: 10px;
    letter-spacing: 0.16em;
    text-shadow: 0 0 14px rgba(255, 95, 216, 0.35);
  }

  .menu-content {
    position: relative;
    z-index: 3;
    width: min(665px, 74vw);
    margin-top: clamp(48px, 10vh, 112px);
    animation: menu-in 900ms cubic-bezier(0.16, 1, 0.3, 1) both;
  }

  @keyframes menu-in {
    from { opacity: 0; transform: translateY(18px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .menu-kicker {
    margin-bottom: 18px;
    animation: menu-in 800ms 80ms cubic-bezier(0.16, 1, 0.3, 1) both;
  }

  .menu-title {
    margin: 0;
    font-family: var(--display);
    font-weight: 400;
    text-transform: uppercase;
    color: var(--cream);
    text-shadow: 0 14px 46px rgba(0, 0, 0, 0.55);
    animation: menu-in 900ms 120ms cubic-bezier(0.16, 1, 0.3, 1) both;
  }

  .title-eyebrow {
    display: block;
    margin-bottom: 3px;
    color: var(--mint);
    font-size: clamp(12px, 1.2vw, 16px);
    letter-spacing: 0.48em;
    line-height: 1.2;
  }

  .title-main {
    display: block;
    font-size: clamp(52px, 7.2vw, 108px);
    line-height: 0.94;
    letter-spacing: -0.025em;
    white-space: nowrap;
  }

  .title-quote {
    color: var(--pink);
    text-shadow: 0 0 30px rgba(255, 95, 216, 0.34);
  }

  .menu-lead {
    max-width: 520px;
    margin: 23px 0 25px;
    color: #c9bbdb;
    font-size: clamp(13px, 1.15vw, 16px);
    font-weight: 420;
    line-height: 1.62;
    animation: menu-in 900ms 180ms cubic-bezier(0.16, 1, 0.3, 1) both;
  }

  .menu-lead strong {
    color: var(--cream);
    font-weight: 650;
  }

  .mission-facts {
    display: flex;
    flex-wrap: wrap;
    gap: 9px;
    animation: menu-in 900ms 230ms cubic-bezier(0.16, 1, 0.3, 1) both;
  }

  .fact {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 132px;
    padding: 9px 13px 9px 10px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 11px;
    background: linear-gradient(145deg, rgba(33, 21, 51, 0.6), rgba(12, 8, 22, 0.52));
    backdrop-filter: blur(10px);
  }

  .fact-icon {
    display: grid;
    place-items: center;
    width: 34px;
    height: 34px;
    border-radius: 9px;
    color: var(--mint);
    background: rgba(130, 255, 211, 0.06);
    border: 1px solid rgba(130, 255, 211, 0.14);
  }

  .fact-copy {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .fact-copy small {
    color: var(--muted);
    font-family: var(--display);
    font-size: 7px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
  }

  .fact-copy b {
    color: var(--cream);
    font-family: var(--display);
    font-size: 11px;
    font-weight: 400;
    letter-spacing: 0.04em;
  }

  .menu-cta-row {
    display: flex;
    align-items: center;
    gap: 11px;
    margin-top: 27px;
    animation: menu-in 900ms 280ms cubic-bezier(0.16, 1, 0.3, 1) both;
  }

  .primary-btn {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 16px;
    min-height: 52px;
    padding: 14px 18px 14px 25px;
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.75);
    background: var(--cream);
    color: #180d24;
    font-family: var(--display);
    font-size: 12px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    box-shadow: 0 10px 34px rgba(255, 95, 216, 0.17), inset 0 1px 0 rgba(255, 255, 255, 0.8);
    transition: transform 180ms ease, box-shadow 180ms ease, background 180ms ease;
    overflow: hidden;
  }

  .primary-btn::after {
    content: '';
    position: absolute;
    top: -70%;
    left: -35%;
    width: 25%;
    height: 240%;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.72), transparent);
    transform: rotate(20deg);
    animation: btn-shine 5.6s ease-in-out infinite;
    pointer-events: none;
  }

  @keyframes btn-shine {
    0%, 62%, 100% { left: -40%; }
    78% { left: 120%; }
  }

  .primary-btn:hover {
    transform: translateY(-2px);
    background: #fff7e7;
    box-shadow: 0 16px 40px rgba(255, 95, 216, 0.3), inset 0 1px 0 #fff;
  }

  .primary-btn:active {
    transform: translateY(0) scale(0.985);
  }

  .btn-arrow {
    display: grid;
    place-items: center;
    width: 27px;
    height: 27px;
    border-radius: 50%;
    background: #1b1027;
    color: var(--cream);
    transition: transform 180ms ease;
  }

  .primary-btn:hover .btn-arrow {
    transform: translateX(3px);
  }

  .ghost-btn {
    min-height: 52px;
    padding: 12px 20px;
    border-radius: 12px;
    border: 1px solid rgba(246, 237, 218, 0.26);
    color: var(--cream);
    background: rgba(12, 8, 22, 0.36);
    font-family: var(--display);
    font-size: 10px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    backdrop-filter: blur(10px);
    transition: border-color 160ms ease, background 160ms ease, color 160ms ease, transform 160ms ease;
  }

  .ghost-btn:hover {
    border-color: rgba(255, 95, 216, 0.58);
    background: rgba(255, 95, 216, 0.09);
    color: var(--pink-soft);
    transform: translateY(-1px);
  }

  .menu-controls {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 12px 18px;
    margin-top: 24px;
    color: #a99abb;
    font-family: var(--display);
    font-size: 8px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    animation: menu-in 900ms 330ms cubic-bezier(0.16, 1, 0.3, 1) both;
  }

  .controls-label {
    padding-right: 4px;
    color: rgba(246, 237, 218, 0.42);
  }

  .key-combo {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    white-space: nowrap;
  }

  kbd {
    display: inline-grid;
    place-items: center;
    min-width: 23px;
    height: 23px;
    padding: 0 5px;
    border: 1px solid rgba(246, 237, 218, 0.2);
    border-bottom-width: 2px;
    border-radius: 5px;
    background: rgba(246, 237, 218, 0.06);
    color: rgba(246, 237, 218, 0.8);
    font-family: var(--display);
    font-size: 8px;
    line-height: 1;
    letter-spacing: 0.03em;
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06);
  }

  .menu-note {
    margin: 18px 0 0;
    color: rgba(201, 187, 219, 0.58);
    font-size: 10px;
    letter-spacing: 0.02em;
    animation: menu-in 900ms 380ms cubic-bezier(0.16, 1, 0.3, 1) both;
  }

  .menu-note span {
    margin-right: 6px;
    color: var(--yellow);
  }

  .touch-note {
    display: flex;
    gap: 10px;
    color: var(--mint);
  }

  .menu-side {
    position: fixed;
    right: clamp(22px, 4.2vw, 70px);
    bottom: clamp(88px, 13vh, 132px);
    z-index: 4;
    width: 252px;
    padding: 14px 15px 13px;
    border: 1px solid rgba(255, 255, 255, 0.13);
    border-radius: 15px;
    background: linear-gradient(155deg, rgba(27, 17, 43, 0.78), rgba(10, 7, 18, 0.7));
    backdrop-filter: blur(16px) saturate(1.15);
    box-shadow: 0 22px 60px rgba(0, 0, 0, 0.36);
    transform: rotate(-1.2deg);
    animation: side-in 1s 500ms cubic-bezier(0.16, 1, 0.3, 1) both;
  }

  @keyframes side-in {
    from { opacity: 0; transform: translateY(12px) rotate(-2deg); }
    to { opacity: 1; transform: translateY(0) rotate(-1.2deg); }
  }

  .side-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 11px;
    color: var(--cream);
    font-family: var(--display);
    font-size: 8px;
    letter-spacing: 0.14em;
  }

  .side-head > span:first-child {
    display: flex;
    align-items: center;
    gap: 7px;
  }

  .side-code {
    color: rgba(246, 237, 218, 0.35);
  }

  .side-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 7px 0;
    border-top: 1px solid rgba(255, 255, 255, 0.07);
    font-family: var(--display);
    font-size: 7px;
    letter-spacing: 0.08em;
  }

  .side-row span {
    color: rgba(246, 237, 218, 0.42);
  }

  .side-row b {
    color: var(--cream-dim);
    font-weight: 400;
    text-align: right;
  }

  .pink-text { color: var(--pink-soft) !important; }
  .mint-text { color: var(--mint) !important; }

  .side-aliens {
    display: flex;
    align-items: flex-end;
    gap: 7px;
    margin: 12px 0 6px;
    padding-top: 11px;
    border-top: 1px solid rgba(255, 255, 255, 0.09);
    color: #b7d3a5;
  }

  .side-aliens :global(svg) {
    filter: drop-shadow(0 0 8px rgba(130, 255, 211, 0.18));
  }

  .side-aliens span {
    margin-left: auto;
    max-width: 64px;
    color: rgba(246, 237, 218, 0.38);
    font-family: var(--display);
    font-size: 6px;
    line-height: 1.45;
    letter-spacing: 0.1em;
  }

  .barcode {
    height: 19px;
    margin-top: 8px;
    opacity: 0.45;
    background: repeating-linear-gradient(90deg, #cfc1dc 0, #cfc1dc 1px, transparent 1px, transparent 3px, #cfc1dc 3px, #cfc1dc 5px, transparent 5px, transparent 8px);
  }

  .side-foot {
    margin-top: 7px;
    color: rgba(246, 237, 218, 0.3);
    font-family: var(--display);
    font-size: 6px;
    letter-spacing: 0.11em;
  }

  .classified-stamp {
    position: absolute;
    top: -27px;
    right: -23px;
    display: grid;
    place-items: center;
    width: 74px;
    height: 74px;
    border: 2px solid rgba(255, 95, 216, 0.55);
    border-radius: 50%;
    color: rgba(255, 123, 224, 0.78);
    font-family: var(--display);
    font-size: 7px;
    line-height: 1.35;
    letter-spacing: 0.08em;
    text-align: center;
    transform: rotate(11deg);
    box-shadow: inset 0 0 0 4px rgba(255, 95, 216, 0.06);
  }

  .classified-stamp::before {
    content: '';
    position: absolute;
    inset: 6px;
    border: 1px solid rgba(255, 95, 216, 0.28);
    border-radius: 50%;
  }

  .menu-footer {
    position: relative;
    z-index: 3;
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 30px;
    margin-top: auto;
    padding-top: 50px;
    color: rgba(246, 237, 218, 0.28);
    font-family: var(--display);
    font-size: 7px;
    letter-spacing: 0.11em;
    text-transform: uppercase;
  }

  .ticker {
    width: min(520px, 55vw);
    overflow: hidden;
    white-space: nowrap;
    mask-image: linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent);
  }

  .ticker div {
    display: inline-block;
    animation: ticker 34s linear infinite;
  }

  @keyframes ticker {
    from { transform: translateX(0); }
    to { transform: translateX(-50%); }
  }

  .build-tag {
    flex: none;
    color: rgba(246, 237, 218, 0.24);
  }

  /* ------------------------------------------------------------------ */
  /*  HUD                                                               */
  /* ------------------------------------------------------------------ */

  .hud {
    position: absolute;
    inset: 0;
    z-index: 20;
    pointer-events: none;
  }

  .topbar {
    position: absolute;
    top: 20px;
    left: 24px;
    right: 24px;
    display: flex;
    align-items: flex-start;
    gap: 14px;
  }

  .brand-card,
  .quota-card {
    border: 1px solid var(--line);
    background: linear-gradient(145deg, rgba(24, 15, 40, 0.82), rgba(10, 7, 18, 0.66));
    backdrop-filter: blur(14px) saturate(1.15);
    box-shadow: 0 12px 34px rgba(0, 0, 0, 0.26);
    border-radius: 15px;
  }

  .brand-card {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 15px 8px 8px;
  }

  .brand-mark {
    display: grid;
    place-items: center;
    width: 42px;
    height: 42px;
    border-radius: 11px;
    color: var(--mint);
    background: radial-gradient(circle at 50% 35%, rgba(130, 255, 211, 0.17), rgba(130, 255, 211, 0.02) 65%);
    border: 1px solid rgba(130, 255, 211, 0.18);
    box-shadow: inset 0 0 18px rgba(130, 255, 211, 0.06);
  }

  .brand-copy {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .brand-copy .eyebrow {
    font-size: 7px;
    letter-spacing: 0.15em;
    color: rgba(246, 237, 218, 0.42);
  }

  .brand-copy strong {
    color: var(--cream);
    font-family: var(--display);
    font-size: 11px;
    font-weight: 400;
    letter-spacing: 0.025em;
    white-space: nowrap;
  }

  .timer-card {
    position: absolute;
    left: 50%;
    top: 0;
    transform: translateX(-50%);
    display: flex;
    flex-direction: column;
    align-items: center;
    min-width: 152px;
    padding: 8px 18px 10px;
    border: 1px solid var(--line);
    border-radius: 15px;
    background: linear-gradient(160deg, rgba(26, 16, 43, 0.8), rgba(10, 7, 18, 0.64));
    backdrop-filter: blur(14px) saturate(1.15);
    box-shadow: 0 12px 34px rgba(0, 0, 0, 0.24);
    overflow: hidden;
  }

  .timer-card::before {
    content: '';
    position: absolute;
    top: 0;
    left: 22%;
    right: 22%;
    height: 1px;
    background: linear-gradient(90deg, transparent, var(--pink), transparent);
    opacity: 0.7;
  }

  .timer-card .eyebrow {
    color: rgba(246, 237, 218, 0.46);
    font-size: 7px;
    letter-spacing: 0.2em;
  }

  .timer-value {
    margin: 1px 0 4px;
    color: var(--cream);
    font-family: var(--display);
    font-size: 28px;
    line-height: 1.1;
    letter-spacing: 0.055em;
    font-variant-numeric: tabular-nums;
    text-shadow: 0 0 22px rgba(255, 95, 216, 0.12);
  }

  .timer-track {
    width: 100%;
    height: 2px;
    border-radius: 99px;
    background: rgba(255, 255, 255, 0.1);
    overflow: hidden;
  }

  .timer-track > div {
    height: 100%;
    border-radius: inherit;
    background: linear-gradient(90deg, var(--mint), var(--pink));
    transition: width 260ms linear;
  }

  .timer-card.urgent {
    border-color: rgba(255, 107, 107, 0.45);
    animation: urgent-pulse 1.4s ease-in-out infinite;
  }

  .timer-card.urgent .timer-value {
    color: #ffb3ad;
    text-shadow: 0 0 24px rgba(255, 90, 90, 0.5);
  }

  .timer-card.urgent .timer-track > div {
    background: linear-gradient(90deg, #ff9a72, #ff4e77);
  }

  @keyframes urgent-pulse {
    0%, 100% { box-shadow: 0 0 0 rgba(255, 80, 80, 0); }
    50% { box-shadow: 0 0 30px rgba(255, 75, 80, 0.2); }
  }

  .top-right {
    display: flex;
    align-items: stretch;
    gap: 8px;
    margin-left: auto;
  }

  .quota-card {
    min-width: 234px;
    padding: 8px 13px 8px;
  }

  .quota-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
  }

  .quota-head strong {
    color: var(--cream);
    font-family: var(--display);
    font-size: 22px;
    font-weight: 400;
    line-height: 1;
    letter-spacing: 0.02em;
  }

  .quota-head strong em {
    color: rgba(246, 237, 218, 0.42);
    font-size: 11px;
    font-style: normal;
  }

  .cow-slots {
    display: flex;
    align-items: center;
    gap: 2px;
    margin-top: 5px;
  }

  .cow-slot {
    display: grid;
    place-items: center;
    width: 22px;
    height: 22px;
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.035);
    transition: background 220ms ease;
  }

  .cow-slot.filled {
    background: rgba(255, 95, 216, 0.1);
  }

  .hud-buttons {
    display: flex;
    flex-direction: column;
    gap: 7px;
  }

  .hud-side {
    position: absolute;
    left: 24px;
    bottom: 24px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: 168px;
  }

  .score-card {
    padding: 10px 13px 11px;
    border: 1px solid var(--line);
    border-radius: 13px;
    background: linear-gradient(150deg, rgba(24, 15, 40, 0.78), rgba(10, 7, 18, 0.62));
    backdrop-filter: blur(12px);
    box-shadow: 0 12px 30px rgba(0, 0, 0, 0.2);
  }

  .score-card strong {
    display: block;
    color: var(--cream);
    font-family: var(--display);
    font-size: 27px;
    font-weight: 400;
    line-height: 1.1;
    letter-spacing: 0.02em;
    font-variant-numeric: tabular-nums;
  }

  .score-card small {
    color: rgba(246, 237, 218, 0.42);
    font-family: var(--display);
    font-size: 7px;
    letter-spacing: 0.1em;
  }

  .combo-card {
    padding: 9px 12px 10px;
    border: 1px solid rgba(255, 95, 216, 0.38);
    border-radius: 12px;
    background: linear-gradient(140deg, rgba(54, 18, 56, 0.85), rgba(17, 9, 26, 0.75));
    box-shadow: 0 0 28px rgba(255, 95, 216, 0.12);
    animation: combo-in 260ms cubic-bezier(0.16, 1, 0.3, 1);
  }

  @keyframes combo-in {
    from { opacity: 0; transform: translateY(5px) scale(0.97); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }

  .combo-copy {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
  }

  .combo-copy span {
    color: var(--pink-soft);
    font-family: var(--display);
    font-size: 8px;
    letter-spacing: 0.14em;
  }

  .combo-copy strong {
    color: var(--cream);
    font-family: var(--display);
    font-size: 20px;
    font-weight: 400;
  }

  .combo-track {
    height: 2px;
    margin-top: 5px;
    border-radius: 9px;
    background: rgba(255, 255, 255, 0.13);
    overflow: hidden;
  }

  .combo-track > div {
    height: 100%;
    background: var(--pink);
    transition: width 120ms linear;
  }

  .hud-bottom {
    position: absolute;
    left: 50%;
    bottom: 23px;
    transform: translateX(-50%);
    width: min(560px, calc(100vw - 410px));
    min-width: 400px;
  }

  .beam-card {
    position: relative;
    padding: 12px 16px 10px;
    border: 1px solid var(--line);
    border-radius: 15px;
    background: linear-gradient(160deg, rgba(23, 14, 39, 0.87), rgba(9, 6, 17, 0.74));
    backdrop-filter: blur(16px) saturate(1.12);
    box-shadow: 0 16px 44px rgba(0, 0, 0, 0.34);
    overflow: hidden;
  }

  .beam-card::before {
    content: '';
    position: absolute;
    top: 0;
    left: 8%;
    right: 8%;
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(255, 95, 216, 0.9), rgba(130, 255, 211, 0.8), transparent);
    opacity: 0.8;
  }

  .beam-card.is-hot {
    border-color: rgba(255, 107, 107, 0.4);
    box-shadow: 0 0 34px rgba(255, 80, 80, 0.12), 0 16px 44px rgba(0, 0, 0, 0.34);
  }

  .beam-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
  }

  .beam-label {
    display: flex;
    align-items: center;
    gap: 7px;
    color: var(--cream);
    font-family: var(--display);
    font-size: 8px;
    letter-spacing: 0.14em;
  }

  .status-dot {
    display: inline-block;
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: rgba(246, 237, 218, 0.3);
    transition: background 160ms ease, box-shadow 160ms ease;
  }

  .status-dot.active {
    background: var(--pink);
    box-shadow: 0 0 0 3px rgba(255, 95, 216, 0.14), 0 0 12px rgba(255, 95, 216, 0.8);
    animation: live-pulse 1.5s ease-in-out infinite;
  }

  .beam-message {
    max-width: 63%;
    overflow: hidden;
    color: var(--pink-soft);
    font-family: var(--display);
    font-size: 8px;
    letter-spacing: 0.08em;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .beam-message.warning {
    color: #ffb18a;
    animation: blink 0.8s steps(2) infinite;
  }

  @keyframes blink {
    50% { opacity: 0.35; }
  }

  .energy-row {
    display: flex;
    align-items: center;
    gap: 9px;
    margin-top: 8px;
  }

  .energy-label {
    flex: none;
    width: 46px;
    color: rgba(246, 237, 218, 0.42);
    font-family: var(--display);
    font-size: 6px;
    letter-spacing: 0.12em;
  }

  .energy-track {
    position: relative;
    flex: 1;
    height: 8px;
    border-radius: 3px;
    background: rgba(255, 255, 255, 0.075);
    box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.4);
    overflow: hidden;
  }

  .energy-fill {
    height: 100%;
    border-radius: inherit;
    background: linear-gradient(90deg, #7dffd2, #ff6ade 66%, #c485ff);
    box-shadow: 0 0 12px rgba(255, 95, 216, 0.35);
    transition: width 120ms linear, background 200ms ease;
  }

  .is-empty .energy-fill {
    background: linear-gradient(90deg, #ffcf70, #ff6d6d);
    box-shadow: 0 0 12px rgba(255, 95, 80, 0.45);
  }

  .energy-ticks {
    position: absolute;
    inset: 0;
    background: repeating-linear-gradient(90deg, transparent 0, transparent 23px, rgba(8, 5, 15, 0.55) 23px, rgba(8, 5, 15, 0.55) 25px);
  }

  .energy-value {
    flex: none;
    width: 33px;
    color: var(--cream-dim);
    font-family: var(--display);
    font-size: 8px;
    font-weight: 400;
    text-align: right;
    font-variant-numeric: tabular-nums;
  }

  .capture-row {
    display: flex;
    align-items: center;
    gap: 9px;
    margin-top: 7px;
    opacity: 0.58;
    transition: opacity 180ms ease;
  }

  .capture-row.has-target {
    opacity: 1;
  }

  .capture-name {
    flex: none;
    width: 105px;
    overflow: hidden;
    color: rgba(246, 237, 218, 0.56);
    font-family: var(--display);
    font-size: 6px;
    letter-spacing: 0.08em;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .capture-track {
    flex: 1;
    height: 3px;
    border-radius: 9px;
    background: rgba(255, 255, 255, 0.09);
    overflow: hidden;
  }

  .capture-fill {
    height: 100%;
    background: linear-gradient(90deg, var(--violet), var(--pink));
    border-radius: inherit;
    transition: width 100ms linear;
  }

  .capture-row strong {
    flex: none;
    width: 30px;
    color: var(--pink-soft);
    font-family: var(--display);
    font-size: 7px;
    font-weight: 400;
    text-align: right;
    font-variant-numeric: tabular-nums;
  }

  .beam-hint {
    margin-top: 6px;
    color: rgba(246, 237, 218, 0.35);
    font-size: 8px;
    letter-spacing: 0.015em;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .controls-hint {
    position: absolute;
    right: 24px;
    bottom: 24px;
    display: flex;
    align-items: center;
    gap: 13px;
    padding: 9px 13px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 11px;
    background: rgba(13, 8, 22, 0.48);
    color: rgba(246, 237, 218, 0.38);
    font-family: var(--display);
    font-size: 7px;
    letter-spacing: 0.06em;
    backdrop-filter: blur(10px);
  }

  .controls-hint span {
    display: flex;
    align-items: center;
    gap: 3px;
    white-space: nowrap;
  }

  .controls-hint kbd {
    min-width: 19px;
    height: 19px;
    font-size: 7px;
    border-color: rgba(246, 237, 218, 0.12);
    color: rgba(246, 237, 218, 0.6);
  }

  /* ------------------------------------------------------------------ */
  /*  Touch controls                                                     */
  /* ------------------------------------------------------------------ */

  .touch-controls {
    position: absolute;
    left: 18px;
    right: 18px;
    bottom: 16px;
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    pointer-events: none;
  }

  .dpad {
    position: relative;
    display: grid;
    grid-template-columns: repeat(3, 46px);
    grid-template-rows: repeat(2, 46px);
    gap: 6px;
    pointer-events: auto;
  }

  .touch-btn {
    display: grid;
    place-items: center;
    border: 1px solid rgba(246, 237, 218, 0.19);
    border-radius: 13px;
    background: rgba(16, 10, 29, 0.66);
    color: var(--cream);
    backdrop-filter: blur(10px);
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.28);
    touch-action: none;
  }

  .touch-btn:active {
    background: rgba(255, 95, 216, 0.18);
    border-color: rgba(255, 95, 216, 0.5);
  }

  .dpad-up { grid-column: 2; grid-row: 1; }
  .dpad-left { grid-column: 1; grid-row: 2; }
  .dpad-right { grid-column: 3; grid-row: 2; }
  .dpad-down { grid-column: 2; grid-row: 2; }

  .touch-beam {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    width: 84px;
    height: 84px;
    border: 1px solid rgba(255, 95, 216, 0.55);
    border-radius: 50%;
    background: radial-gradient(circle at 50% 34%, rgba(255, 95, 216, 0.33), rgba(27, 12, 38, 0.83) 67%);
    color: var(--cream);
    font-family: var(--display);
    font-size: 8px;
    letter-spacing: 0.12em;
    box-shadow: 0 0 26px rgba(255, 95, 216, 0.22), inset 0 0 20px rgba(255, 95, 216, 0.1);
    backdrop-filter: blur(10px);
    pointer-events: auto;
    touch-action: none;
  }

  .touch-beam :global(svg) {
    color: var(--pink-soft);
  }

  .touch-beam.held {
    background: radial-gradient(circle at 50% 34%, rgba(255, 123, 224, 0.7), rgba(75, 20, 78, 0.92) 70%);
    box-shadow: 0 0 42px rgba(255, 95, 216, 0.48), inset 0 0 28px rgba(255, 255, 255, 0.12);
    transform: scale(0.96);
  }

  .is-touch .hud-bottom {
    bottom: 118px;
    width: calc(100vw - 32px);
    min-width: 0;
  }

  .is-touch .hud-side,
  .is-touch .controls-hint {
    display: none;
  }

  /* ------------------------------------------------------------------ */
  /*  Toasts, modals, flash                                             */
  /* ------------------------------------------------------------------ */

  .toast-wrap {
    position: absolute;
    top: 102px;
    left: 50%;
    z-index: 55;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 7px;
    transform: translateX(-50%);
    pointer-events: none;
  }

  .toast {
    display: flex;
    align-items: center;
    gap: 9px;
    max-width: min(520px, 84vw);
    padding: 9px 14px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 999px;
    background: rgba(13, 8, 22, 0.88);
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.32);
    backdrop-filter: blur(14px);
    color: var(--cream);
    font-family: var(--display);
    font-size: 9px;
    letter-spacing: 0.07em;
    text-transform: uppercase;
    animation: toast-in 280ms cubic-bezier(0.16, 1, 0.3, 1);
  }

  @keyframes toast-in {
    from { opacity: 0; transform: translateY(-7px) scale(0.97); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }

  .toast i {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: var(--pink);
    box-shadow: 0 0 10px currentColor;
  }

  .toast b {
    padding: 2px 6px;
    border-radius: 4px;
    background: var(--pink);
    color: #1d0c24;
    font-size: 7px;
    font-weight: 400;
    white-space: nowrap;
  }

  .toast-success { border-color: rgba(255, 95, 216, 0.35); }
  .toast-success i { background: var(--pink); color: var(--pink); }
  .toast-warning { border-color: rgba(255, 137, 111, 0.42); }
  .toast-warning i { background: #ff9a72; color: #ff9a72; }
  .toast-mint i { background: var(--mint); color: var(--mint); }
  .toast-info i { background: var(--mint); color: var(--mint); }

  .modal-layer {
    position: absolute;
    inset: 0;
    z-index: 60;
    display: grid;
    place-items: center;
    padding: 22px;
    background: rgba(5, 3, 11, 0.59);
    backdrop-filter: blur(9px) saturate(0.9);
    animation: modal-fade 260ms ease both;
  }

  @keyframes modal-fade {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .modal-card,
  .end-card {
    position: relative;
    border: 1px solid rgba(255, 255, 255, 0.14);
    background:
      radial-gradient(ellipse at 50% 0%, rgba(111, 63, 133, 0.23), transparent 57%),
      linear-gradient(155deg, rgba(27, 17, 43, 0.96), rgba(10, 6, 18, 0.97));
    box-shadow: 0 34px 100px rgba(0, 0, 0, 0.55);
  }

  .pause-card {
    width: min(440px, 92vw);
    padding: 26px 30px 24px;
    border-radius: 21px;
    text-align: center;
  }

  .pause-mark {
    display: grid;
    place-items: center;
    width: 78px;
    height: 78px;
    margin: 15px auto 7px;
    border-radius: 50%;
    border: 1px solid rgba(130, 255, 211, 0.2);
    background: radial-gradient(circle, rgba(130, 255, 211, 0.1), transparent 68%);
    color: var(--mint);
    animation: hover-y 3.6s ease-in-out infinite;
  }

  @keyframes hover-y {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-5px); }
  }

  .pause-card h2 {
    margin: 2px 0 7px;
    font-family: var(--display);
    font-size: 34px;
    font-weight: 400;
    letter-spacing: 0.04em;
  }

  .pause-card p {
    margin: 0 0 20px;
    color: var(--cream-dim);
    font-size: 13px;
  }

  .modal-actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 10px;
  }

  .modal-actions .primary-btn,
  .modal-actions .ghost-btn {
    min-height: 48px;
  }

  .link-btn {
    margin-top: 14px;
    color: rgba(246, 237, 218, 0.45);
    font-family: var(--display);
    font-size: 8px;
    letter-spacing: 0.1em;
    text-decoration: underline;
    text-underline-offset: 4px;
    transition: color 160ms ease;
  }

  .link-btn:hover {
    color: var(--pink-soft);
  }

  .end-card {
    width: min(615px, 94vw);
    padding: 30px 34px 23px;
    border-radius: 23px;
    text-align: center;
    overflow: hidden;
    animation: end-in 600ms cubic-bezier(0.16, 1, 0.3, 1) both;
  }

  @keyframes end-in {
    from { opacity: 0; transform: translateY(18px) scale(0.985); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }

  .end-accent {
    position: absolute;
    top: 0;
    left: 17%;
    right: 17%;
    height: 2px;
    background: linear-gradient(90deg, transparent, var(--pink), var(--violet), transparent);
  }

  .end-card.won .end-accent {
    background: linear-gradient(90deg, transparent, var(--mint), var(--pink), transparent);
    box-shadow: 0 0 24px rgba(130, 255, 211, 0.35);
  }

  .end-card.lost .end-accent {
    background: linear-gradient(90deg, transparent, var(--yellow), #ff8364, transparent);
  }

  .end-mark {
    display: grid;
    place-items: center;
    width: 86px;
    height: 86px;
    margin: 0 auto 8px;
    border-radius: 50%;
    border: 1px solid rgba(130, 255, 211, 0.22);
    background: radial-gradient(circle, rgba(130, 255, 211, 0.13), transparent 68%);
    color: var(--mint);
    box-shadow: 0 0 40px rgba(130, 255, 211, 0.09);
  }

  .end-card.lost .end-mark {
    color: var(--yellow);
    border-color: rgba(255, 209, 102, 0.2);
    background: radial-gradient(circle, rgba(255, 209, 102, 0.11), transparent 68%);
  }

  .end-card h2 {
    margin: 4px 0 10px;
    font-family: var(--display);
    font-size: clamp(27px, 3.4vw, 42px);
    font-weight: 400;
    line-height: 1.04;
    letter-spacing: 0.015em;
  }

  .end-lead {
    max-width: 470px;
    margin: 0 auto 20px;
    color: var(--cream-dim);
    font-size: 12px;
    line-height: 1.55;
  }

  .end-stats {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    margin: 0 -4px 21px;
  }

  .end-stats > div {
    padding: 13px 8px 12px;
  }

  .end-stats > div + div {
    border-left: 1px solid rgba(255, 255, 255, 0.09);
  }

  .end-stats span {
    display: block;
    margin-bottom: 3px;
    color: var(--muted);
    font-family: var(--display);
    font-size: 7px;
    letter-spacing: 0.14em;
  }

  .end-stats strong {
    color: var(--cream);
    font-family: var(--display);
    font-size: 24px;
    font-weight: 400;
    letter-spacing: 0.02em;
    font-variant-numeric: tabular-nums;
  }

  .end-stats strong em {
    color: rgba(246, 237, 218, 0.4);
    font-size: 11px;
    font-style: normal;
  }

  .end-actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 10px;
  }

  .end-flavor {
    margin: 16px 0 0;
    color: rgba(246, 237, 218, 0.34);
    font-size: 9px;
    letter-spacing: 0.01em;
  }

  /* Help */
  .help-card {
    width: min(650px, 94vw);
    max-height: 92svh;
    padding: 25px 27px 22px;
    border-radius: 21px;
    overflow-y: auto;
    animation: end-in 420ms cubic-bezier(0.16, 1, 0.3, 1) both;
  }

  .help-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 20px;
    margin-bottom: 12px;
  }

  .help-head h2 {
    margin: 4px 0 0;
    font-family: var(--display);
    font-size: clamp(23px, 3vw, 31px);
    font-weight: 400;
    letter-spacing: 0.01em;
  }

  .help-list {
    display: flex;
    flex-direction: column;
  }

  .help-row {
    display: grid;
    grid-template-columns: 28px 1fr auto;
    align-items: start;
    gap: 12px;
    padding: 12px 0;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
  }

  .help-num {
    color: var(--pink);
    font-family: var(--display);
    font-size: 10px;
    line-height: 1.6;
  }

  .help-row b {
    display: block;
    margin-bottom: 3px;
    color: var(--cream);
    font-family: var(--display);
    font-size: 9px;
    font-weight: 400;
    letter-spacing: 0.06em;
  }

  .help-row p {
    max-width: 390px;
    margin: 0;
    color: rgba(202, 189, 216, 0.68);
    font-size: 10.5px;
    line-height: 1.48;
  }

  .help-key {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 3px;
    padding-top: 1px;
  }

  .help-key kbd {
    height: 22px;
    min-width: 20px;
    font-size: 7px;
  }

  .mini-energy {
    display: flex;
    align-items: center;
    width: 54px;
    height: 7px;
    padding: 2px;
    border-radius: 9px;
    background: rgba(255, 255, 255, 0.09);
  }

  .mini-energy i {
    width: 68%;
    height: 100%;
    border-radius: 9px;
    background: linear-gradient(90deg, var(--mint), var(--pink));
  }

  .combo-chip {
    display: grid;
    place-items: center;
    min-width: 36px;
    height: 23px;
    border-radius: 6px;
    background: rgba(255, 95, 216, 0.14);
    color: var(--pink-soft);
    font-family: var(--display);
    font-size: 11px;
    font-weight: 400;
  }

  .help-goal {
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 9px 0 17px;
    padding: 11px 13px;
    border: 1px solid rgba(255, 95, 216, 0.17);
    border-radius: 10px;
    background: rgba(255, 95, 216, 0.045);
  }

  .help-goal p {
    margin: 0;
    color: rgba(246, 237, 218, 0.66);
    font-size: 11px;
  }

  .help-goal b {
    color: var(--cream);
  }

  .primary-btn.wide {
    width: 100%;
  }

  /* Loading and error */
  .loading-screen {
    position: absolute;
    inset: 0;
    z-index: 90;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background:
      radial-gradient(circle at 50% 42%, rgba(102, 57, 129, 0.2), transparent 45%),
      #08050f;
  }

  .loader-mark {
    position: relative;
    display: grid;
    place-items: center;
    width: 150px;
    height: 130px;
    color: var(--mint);
    animation: hover-y 2.6s ease-in-out infinite;
  }

  .loader-beam {
    position: absolute;
    top: 72px;
    width: 78px;
    height: 90px;
    background: linear-gradient(180deg, rgba(255, 95, 216, 0.32), transparent);
    clip-path: polygon(45% 0, 55% 0, 100% 100%, 0 100%);
    filter: blur(1px);
    animation: loader-beam 1.8s ease-in-out infinite;
  }

  @keyframes loader-beam {
    0%, 100% { opacity: 0.35; transform: scaleX(0.9); }
    50% { opacity: 0.7; transform: scaleX(1.05); }
  }

  .loader-title {
    margin-top: 5px;
    color: var(--cream);
    font-family: var(--display);
    font-size: clamp(21px, 3vw, 30px);
    letter-spacing: 0.06em;
    text-align: center;
  }

  .loader-text {
    margin-top: 12px;
    color: var(--muted);
    font-family: var(--display);
    font-size: 8px;
    letter-spacing: 0.2em;
  }

  .loader-dots {
    display: inline-block;
    width: 18px;
    text-align: left;
    animation: blink 1.1s steps(2) infinite;
  }

  .loader-track {
    width: 190px;
    height: 2px;
    margin-top: 15px;
    background: rgba(255, 255, 255, 0.09);
    overflow: hidden;
  }

  .loader-track div {
    width: 40%;
    height: 100%;
    background: linear-gradient(90deg, var(--pink), var(--mint));
    animation: loader-track 1.5s ease-in-out infinite;
  }

  @keyframes loader-track {
    0% { transform: translateX(-120%); }
    100% { transform: translateX(360%); }
  }

  .loader-note {
    margin-top: 22px;
    color: rgba(246, 237, 218, 0.26);
    font-family: var(--display);
    font-size: 7px;
    letter-spacing: 0.15em;
  }

  .error-screen {
    position: absolute;
    inset: 0;
    z-index: 95;
    display: grid;
    place-items: center;
    padding: 24px;
    background: #08050f;
  }

  .error-card {
    width: min(480px, 94vw);
    padding: 28px;
    border-radius: 18px;
    background: linear-gradient(150deg, #1c112d, #0c0716);
  }

  .error-card h2 {
    margin: 8px 0 10px;
    font-family: var(--display);
    font-size: 27px;
    font-weight: 400;
  }

  .error-card p {
    color: var(--cream-dim);
    font-size: 12px;
    line-height: 1.5;
  }

  .error-card .muted {
    color: rgba(246, 237, 218, 0.4);
  }

  .screen-flash {
    position: absolute;
    inset: 0;
    z-index: 70;
    pointer-events: none;
    mix-blend-mode: screen;
    animation: flash 460ms ease-out both;
  }

  .flash-pink {
    background: radial-gradient(circle at 50% 48%, rgba(255, 95, 216, 0.3), transparent 55%);
  }

  .flash-mint {
    background: radial-gradient(circle at 50% 48%, rgba(130, 255, 211, 0.24), transparent 57%);
  }

  .flash-warning {
    background: radial-gradient(circle at 50% 48%, rgba(255, 105, 92, 0.24), transparent 58%);
  }

  @keyframes flash {
    0% { opacity: 0; }
    16% { opacity: 1; }
    100% { opacity: 0; }
  }

  /* ------------------------------------------------------------------ */
  /*  Responsive                                                        */
  /* ------------------------------------------------------------------ */

  @media (max-width: 1120px) {
    .menu-side {
      display: none;
    }

    .menu-content {
      width: min(660px, 80vw);
    }

    .hud-bottom {
      width: min(520px, calc(100vw - 380px));
    }

    .controls-hint {
      gap: 8px;
      padding: 8px 10px;
    }

    .controls-hint span:nth-child(1) {
      display: none;
    }
  }

  @media (max-width: 860px) {
    .topbar {
      top: 14px;
      left: 14px;
      right: 14px;
      gap: 8px;
    }

    .brand-card {
      padding: 6px 10px 6px 6px;
    }

    .brand-mark {
      width: 36px;
      height: 36px;
    }

    .brand-copy strong {
      font-size: 9px;
    }

    .brand-copy .eyebrow {
      display: none;
    }

    .timer-card {
      min-width: 122px;
      padding: 7px 12px 8px;
    }

    .timer-value {
      font-size: 23px;
    }

    .quota-card {
      min-width: 190px;
      padding: 7px 10px;
    }

    .quota-head strong {
      font-size: 18px;
    }

    .cow-slot {
      width: 18px;
      height: 18px;
    }

    .cow-slot :global(.cow-icon) {
      width: 16px;
      height: 16px;
    }

    .quota-card .eyebrow {
      font-size: 7px;
    }

    .icon-btn {
      width: 35px;
      height: 35px;
      border-radius: 10px;
    }

    .hud-buttons {
      gap: 5px;
    }

    .hud-bottom {
      width: calc(100vw - 32px);
      min-width: 0;
      bottom: 18px;
    }

    .hud-side {
      display: none;
    }

    .controls-hint {
      display: none;
    }

    .toast-wrap {
      top: 86px;
    }

    .menu-screen {
      padding: 18px 22px 18px;
    }

    .menu-content {
      width: 100%;
      margin-top: 44px;
    }

    .menu-lead {
      max-width: 570px;
    }

    .ticker {
      width: 70vw;
    }

    .menu-footer {
      padding-top: 40px;
    }
  }

  @media (max-width: 680px) {
    .topbar {
      align-items: stretch;
      gap: 6px;
    }

    .brand-card {
      padding: 5px;
      border-radius: 12px;
    }

    .brand-copy {
      display: none;
    }

    .brand-mark {
      width: 34px;
      height: 34px;
      border: 0;
      background: transparent;
    }

    .timer-card {
      position: relative;
      left: auto;
      transform: none;
      flex: 1;
      max-width: 124px;
      min-width: 0;
      margin: 0 auto;
      border-radius: 12px;
    }

    .timer-value {
      font-size: 20px;
      letter-spacing: 0.03em;
    }

    .timer-card .eyebrow {
      font-size: 6px;
      letter-spacing: 0.11em;
    }

    .top-right {
      flex: 0 0 auto;
      gap: 5px;
    }

    .quota-card {
      min-width: 0;
      width: 137px;
      padding: 6px 8px;
      border-radius: 12px;
    }

    .quota-head {
      gap: 4px;
    }

    .quota-head .eyebrow {
      font-size: 6px;
      letter-spacing: 0.1em;
    }

    .quota-head strong {
      font-size: 16px;
    }

    .cow-slots {
      gap: 0;
      margin-top: 4px;
    }

    .cow-slot {
      width: 15px;
      height: 16px;
      border-radius: 3px;
      background: transparent;
    }

    .cow-slot :global(.cow-icon) {
      width: 14px;
      height: 14px;
    }

    .hud-buttons {
      flex-direction: row;
      align-items: flex-start;
      gap: 4px;
    }

    .icon-btn {
      width: 29px;
      height: 29px;
      border-radius: 8px;
    }

    .icon-btn svg {
      width: 14px;
      height: 14px;
    }

    .toast-wrap {
      top: 75px;
      width: 100%;
    }

    .toast {
      font-size: 8px;
      padding: 8px 11px;
    }

    .beam-card {
      padding: 9px 11px 8px;
      border-radius: 12px;
    }

    .beam-label,
    .beam-message {
      font-size: 7px;
    }

    .beam-hint {
      display: none;
    }

    .capture-name {
      width: 88px;
    }

    .is-touch .hud-bottom {
      bottom: 112px;
    }

    .touch-controls {
      left: 12px;
      right: 12px;
      bottom: 12px;
    }

    .dpad {
      grid-template-columns: repeat(3, 42px);
      grid-template-rows: repeat(2, 42px);
      gap: 5px;
    }

    .touch-beam {
      width: 74px;
      height: 74px;
    }

    .menu-screen {
      padding: 15px 16px 16px;
    }

    .menu-top {
      gap: 10px;
    }

    .menu-brand {
      gap: 7px;
      font-size: 8px;
      letter-spacing: 0.14em;
    }

    .menu-brand i {
      width: 14px;
    }

    .menu-time {
      display: none;
    }

    .menu-content {
      margin-top: 34px;
    }

    .menu-kicker {
      font-size: 8px;
      margin-bottom: 13px;
    }

    .title-eyebrow {
      font-size: 10px;
      letter-spacing: 0.36em;
    }

    .title-main {
      font-size: clamp(43px, 12.6vw, 70px);
      white-space: normal;
      line-height: 0.92;
    }

    .menu-lead {
      margin: 17px 0 18px;
      font-size: 12.5px;
      line-height: 1.55;
    }

    .mission-facts {
      gap: 6px;
    }

    .fact {
      flex: 1 1 100px;
      min-width: 0;
      padding: 7px;
      gap: 6px;
    }

    .fact-icon {
      width: 28px;
      height: 28px;
      border-radius: 7px;
    }

    .fact-icon :global(.cow-icon),
    .fact-icon :global(.ufo-icon),
    .fact-icon svg {
      width: 19px;
      height: 19px;
    }

    .fact-copy b {
      font-size: 9px;
    }

    .fact-copy small {
      font-size: 6px;
    }

    .menu-cta-row {
      flex-wrap: wrap;
      margin-top: 20px;
      gap: 8px;
    }

    .primary-btn {
      min-height: 47px;
      padding: 12px 14px 12px 18px;
      font-size: 10px;
      gap: 10px;
      flex: 1 1 auto;
    }

    .ghost-btn {
      min-height: 47px;
      padding: 10px 15px;
      font-size: 9px;
    }

    .menu-controls {
      margin-top: 17px;
      gap: 8px 12px;
      font-size: 7px;
    }

    kbd {
      min-width: 20px;
      height: 20px;
      font-size: 7px;
    }

    .menu-note {
      margin-top: 13px;
      font-size: 9px;
      line-height: 1.4;
    }

    .menu-footer {
      padding-top: 28px;
      gap: 12px;
    }

    .ticker {
      width: 100%;
      font-size: 6px;
    }

    .build-tag {
      display: none;
    }

    .menu-side {
      display: none;
    }

    .modal-layer {
      padding: 12px;
    }

    .end-card {
      padding: 23px 18px 18px;
      border-radius: 18px;
    }

    .end-mark {
      width: 68px;
      height: 68px;
    }

    .end-mark :global(svg) {
      width: 48px;
      height: 48px;
    }

    .end-card h2 {
      font-size: 27px;
    }

    .end-lead {
      font-size: 11px;
      margin-bottom: 15px;
    }

    .end-stats strong {
      font-size: 20px;
    }

    .end-actions .primary-btn,
    .end-actions .ghost-btn {
      flex: 1 1 140px;
    }

    .pause-card {
      padding: 22px 18px 18px;
    }

    .help-card {
      padding: 19px 17px 17px;
    }

    .help-row {
      grid-template-columns: 21px 1fr;
      gap: 8px;
    }

    .help-key {
      grid-column: 2;
      justify-content: flex-start;
      padding-top: 2px;
    }

    .help-row p {
      font-size: 10px;
    }

    .help-goal {
      font-size: 10px;
    }

    .loading-screen {
      padding: 20px;
    }
  }

  @media (max-height: 720px) and (min-width: 681px) {
    .menu-content {
      margin-top: 36px;
    }

    .title-main {
      font-size: clamp(48px, 6.4vw, 88px);
    }

    .menu-lead {
      margin: 15px 0;
    }

    .menu-footer {
      padding-top: 24px;
    }

    .menu-note {
      display: none;
    }

    .menu-side {
      bottom: 86px;
    }
  }
</style>
