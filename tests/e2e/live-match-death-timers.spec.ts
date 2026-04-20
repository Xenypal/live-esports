import { expect, test, type Page } from '@playwright/test';

import {
  createAmbiguousDeathWindowFrames,
  createFinishedDeathWindowFrames,
  createLateJoinDeathBackfillWindowFrames,
  createLateJoinDeathCurrentWindowFrame,
  createObservedDeathWindowFrames,
  createRespawnedDeathWindowFrames,
  mockLiveMatchApis,
} from './helpers/liveMatchMocks';

function muteMatchAudio(page: Page) {
  return page.addInitScript(() => {
    localStorage.setItem('sound', 'mute');
  });
}

test('dead players show a ticking respawn timer beside the profile', async ({ page }) => {
  await muteMatchAudio(page);

  const observedDeathFrames = createObservedDeathWindowFrames();

  await mockLiveMatchApis(page, {
    initialWindowFrame: observedDeathFrames[0],
    liveWindowFrames: [observedDeathFrames[1]],
  });

  await page.goto('/#/live/match-1/game-index/1');

  await expect(page.getByRole('button', { name: 'Copy Champion Names' })).toBeVisible();
  const deathTimer = page.getByTestId('player-death-timer-8');
  await expect(deathTimer).toBeVisible();

  const initialText = (await deathTimer.textContent()) || '';
  expect(initialText).toMatch(/^☠ 1:0[67]$/);

  await page.waitForTimeout(1200);

  const updatedText = (await deathTimer.textContent()) || '';
  expect(updatedText).toMatch(/^☠ 1:0[56]$/);
  expect(updatedText).not.toBe(initialText);
});

test('late-join tabs reconstruct a death timer from backfilled window history', async ({ page }) => {
  await muteMatchAudio(page);

  const currentDeadFrame = createLateJoinDeathCurrentWindowFrame();

  await mockLiveMatchApis(page, {
    backfillWindowFrames: createLateJoinDeathBackfillWindowFrames(),
    initialWindowFrames: [currentDeadFrame],
    liveWindowFrames: [currentDeadFrame],
  });

  await page.goto('/#/live/match-1/game-index/1');

  await expect(page.getByRole('button', { name: 'Copy Champion Names' })).toBeVisible();
  await expect(page.getByTestId('player-death-timer-8')).toContainText(/^☠ 1:0[12]$/);
});

test('death timer badges use the larger chip styling beside dead players', async ({ page }) => {
  await muteMatchAudio(page);

  const observedDeathFrames = createObservedDeathWindowFrames();

  await mockLiveMatchApis(page, {
    initialWindowFrame: observedDeathFrames[0],
    liveWindowFrames: [observedDeathFrames[1]],
  });

  await page.goto('/#/live/match-1/game-index/1');

  const deathTimer = page.getByTestId('player-death-timer-8');
  await expect(deathTimer).toBeVisible();

  const deathTimerFontSize = await deathTimer.evaluate(element => (
    window.getComputedStyle(element).fontSize
  ));
  expect(deathTimerFontSize).toBe('12px');
});

test('first-seen dead players stay blank until a death is directly observed', async ({ page }) => {
  await muteMatchAudio(page);

  const currentDeadFrame = createLateJoinDeathCurrentWindowFrame();

  await mockLiveMatchApis(page, {
    initialWindowFrames: [currentDeadFrame],
    liveWindowFrames: [currentDeadFrame],
  });

  await page.goto('/#/live/match-1/game-index/1');

  await expect(page.getByRole('button', { name: 'Copy Champion Names' })).toBeVisible();
  await expect(page.getByTestId('player-death-timer-8')).toHaveCount(0);
});

test('ambiguous death jumps do not show a guessed timer', async ({ page }) => {
  await muteMatchAudio(page);

  const ambiguousDeathFrames = createAmbiguousDeathWindowFrames();

  await mockLiveMatchApis(page, {
    initialWindowFrame: ambiguousDeathFrames[0],
    liveWindowFrames: [ambiguousDeathFrames[1]],
  });

  await page.goto('/#/live/match-1/game-index/1');

  await expect(page.getByRole('button', { name: 'Copy Champion Names' })).toBeVisible();
  await expect(page.getByTestId('player-death-timer-8')).toHaveCount(0);
});

test('death timers disappear after the player respawns', async ({ page }) => {
  await muteMatchAudio(page);

  const currentDeadFrame = createLateJoinDeathCurrentWindowFrame();
  await mockLiveMatchApis(page, {
    backfillWindowFrames: createLateJoinDeathBackfillWindowFrames(),
    initialWindowFrames: [currentDeadFrame],
    liveWindowFrames: createRespawnedDeathWindowFrames(),
    liveWindowPollDelayMs: 250,
  });

  await page.goto('/#/live/match-1/game-index/1');

  const deathTimer = page.getByTestId('player-death-timer-8');
  await expect(deathTimer).toBeVisible();
  await page.waitForTimeout(350);
  await expect(deathTimer).toHaveCount(0);
});

test('finished games hide death timers even if the last history frame has a dead player', async ({ page }) => {
  await muteMatchAudio(page);

  const finishedDeathFrames = createFinishedDeathWindowFrames();
  await mockLiveMatchApis(page, {
    initialWindowFrames: finishedDeathFrames,
    liveWindowFrames: [finishedDeathFrames[finishedDeathFrames.length - 1]],
  });

  await page.goto('/#/live/match-1/game-index/1');

  await expect(page.getByRole('button', { name: 'Copy Champion Names' })).toBeVisible();
  await expect(page.getByTestId('player-death-timer-8')).toHaveCount(0);
});
