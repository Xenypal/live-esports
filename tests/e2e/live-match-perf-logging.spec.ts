import { expect, test } from '@playwright/test';

import { createBlueKillWindowFrames, createCompletedEventDetails, createGameEndedWindowFrames, createInProgressEventDetails, mockLiveMatchApis } from './helpers/liveMatchMocks';

test('live match perf logging captures browser-direct polling, state updates, and notifications', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('sound', 'mute');
  });

  await mockLiveMatchApis(page, {
    liveWindowFrames: createBlueKillWindowFrames(),
  });

  await page.goto('/?perfLog=1#/live/match-1/game-index/1');

  await expect(page.getByText('Copy Champion Names')).toBeVisible();
  await expect.poll(async () => {
    return page.evaluate(() => {
      const perfLog = (window as Window & { __livePerfLog?: Array<Record<string, unknown> & { phase: string }> }).__livePerfLog || [];
      return perfLog.some(entry => entry.phase === 'notification_toast_enqueued');
    });
  }).toBeTruthy();

  const phases = await page.evaluate(() => {
    const perfLog = (window as Window & { __livePerfLog?: Array<Record<string, unknown> & { phase: string }> }).__livePerfLog || [];
    const liveWindowUpdate = perfLog.find(entry => entry.phase === 'live_window_state_update');
    const gameRender = perfLog.find(entry => entry.phase === 'game_component_rendered');
    const pollingLoopStarted = perfLog.find(entry => entry.phase === 'polling_loop_started');

    return {
      gameRender,
      phases: perfLog.map(entry => entry.phase),
      liveWindowUpdate,
      pollingLoopStarted,
    };
  });

  expect(phases.pollingLoopStarted).toMatchObject({
    intervalMs: 100,
  });
  expect(phases.liveWindowUpdate).toMatchObject({
    displayedGameTimeSeconds: expect.any(Number),
    windowFrameAgeMs: expect.any(Number),
  });
  expect(phases.gameRender).toMatchObject({
    displayedGameTimeSeconds: expect.any(Number),
    windowFrameAgeMs: expect.any(Number),
  });

  expect(phases.phases).toContain('match_mount');
  expect(phases.phases).toContain('event_details_request_start');
  expect(phases.phases).toContain('event_details_request_success');
  expect(phases.phases).toContain('window_request_success');
  expect(phases.phases).toContain('first_window_state_update');
  expect(phases.phases).toContain('live_window_state_update');
  expect(phases.phases).toContain('details_state_update');
  expect(phases.phases).toContain('notification_toast_enqueued');
  expect(
    phases.phases.includes('match_ready') || phases.phases.includes('match_core_ready')
  ).toBeTruthy();
});

test('live match perf logging captures finish detection and winner resolution timing', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('sound', 'mute');
  });

  const gameEndedWindowFrames = createGameEndedWindowFrames();

  await mockLiveMatchApis(page, {
    eventDetailsResponses: [
      createInProgressEventDetails(),
      createCompletedEventDetails(),
    ],
    initialWindowFrame: gameEndedWindowFrames[0],
    liveWindowFrames: gameEndedWindowFrames,
  });

  await page.goto('/?perfLog=1#/live/match-1/game-index/1');

  await expect(page.getByTestId('game-ended-banner')).toBeVisible();
  await expect(page.getByTestId('game-ended-winner')).toHaveText('FlyQuest WON');

  const phases = await page.evaluate(() => {
    const perfLog = (window as Window & { __livePerfLog?: Array<Record<string, unknown> & { phase: string }> }).__livePerfLog || [];
    return perfLog;
  });

  expect(phases.map(entry => entry.phase)).toContain('game_end_detected');
  expect(phases.map(entry => entry.phase)).toContain('game_end_winner_refresh_started');
  expect(phases).toContainEqual(expect.objectContaining({
    phase: 'game_end_winner_resolved',
    teamName: 'FlyQuest',
    teamSide: 'blue',
  }));
});
