import { expect, test } from '@playwright/test';

import { createBlueKillWindowFrames, mockLiveMatchApis } from './helpers/liveMatchMocks';

test('renders the live game before slow details finish loading', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('sound', 'mute');
  });

  await mockLiveMatchApis(page, {
    detailsDelayMs: 1500,
    liveWindowFrames: createBlueKillWindowFrames(),
  });

  await page.goto('/?perfLog=1#/live/match-1/game-index/1');

  await expect(page.locator('.status-live-game-card').getByText('FlyQuest', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Patch Version: 14.3.1')).toBeVisible();

  const earlyMetrics = await page.evaluate(() => {
    const perfLog = (window as Window & { __livePerfLog?: Array<Record<string, unknown> & { phase: string; perfNowMs: number }> }).__livePerfLog || [];
    const findPhase = (phase: string) => perfLog.find(entry => entry.phase === phase);

    return {
      detailsStateUpdate: findPhase('details_state_update'),
      gameRendered: findPhase('game_component_rendered'),
      liveWindowUpdate: findPhase('live_window_state_update'),
      matchCoreReady: findPhase('match_core_ready'),
      patchVisible: document.body.innerText.includes('Patch Version: 14.3.1'),
    };
  });

  expect(earlyMetrics.liveWindowUpdate).toBeTruthy();
  expect(earlyMetrics.gameRendered).toBeTruthy();
  expect(earlyMetrics.matchCoreReady).toBeTruthy();
  expect(earlyMetrics.patchVisible).toBeTruthy();
  expect(earlyMetrics.detailsStateUpdate).toBeFalsy();

  await expect.poll(async () => {
    return page.evaluate(() => {
      const perfLog = (window as Window & { __livePerfLog?: Array<Record<string, unknown> & { phase: string; perfNowMs: number }> }).__livePerfLog || [];
      return perfLog.find(entry => entry.phase === 'details_state_update')?.perfNowMs;
    });
  }).toBeTruthy();

  const finalDetailsPerfNowMs = await page.evaluate(() => {
    const perfLog = (window as Window & { __livePerfLog?: Array<Record<string, unknown> & { phase: string; perfNowMs: number }> }).__livePerfLog || [];
    return perfLog.find(entry => entry.phase === 'details_state_update')?.perfNowMs;
  });

  expect(earlyMetrics.liveWindowUpdate!.perfNowMs).toBeLessThan(finalDetailsPerfNowMs!);
  expect(earlyMetrics.gameRendered!.perfNowMs).toBeLessThan(finalDetailsPerfNowMs!);
  expect(earlyMetrics.matchCoreReady!.perfNowMs).toBeLessThan(finalDetailsPerfNowMs!);
});

test('keeps the live game stable while item metadata is still loading', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('sound', 'mute');
  });

  const runtimeIssues: string[] = [];
  page.on('pageerror', error => {
    runtimeIssues.push(error.message);
  });
  page.on('console', msg => {
    if (msg.type() !== 'error') {
      return;
    }

    const text = msg.text();
    if (
      text.includes("Cannot read properties of undefined (reading 'name')") ||
      text.includes('javascript:void(0)') ||
      text.includes('unmounted component') ||
      text.includes('unique "key" prop')
    ) {
      runtimeIssues.push(text);
    }
  });

  await mockLiveMatchApis(page, {
    itemsDelayMs: 1500,
    liveWindowFrames: createBlueKillWindowFrames(),
  });

  await page.goto('/#/live/match-1/game-index/1');

  await expect(page.locator('.status-live-game-card').getByText('FlyQuest', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Copy Champion Names' })).toBeVisible();
  await expect(page.locator('.player-stats-item img').first()).toBeVisible();

  await page.waitForTimeout(1800);

  expect(runtimeIssues).toEqual([]);
});
