import { expect, test, type Page } from '@playwright/test';

import {
  createExpiredDeathCountWindowFrames,
  createFullHealthDeathCountWindowFrames,
  createInitialDeathsWindowFrame,
  createMultiDeathJumpWindowFrames,
  createObjectiveTimerInitialWindowFrame,
  createObservedDeathCountWindowFrames,
  createRepeatedDeathCountWindowFrames,
  mockLiveMatchApis,
} from './helpers/liveMatchMocks';

function muteMatchAudio(page: Page) {
  return page.addInitScript(() => {
    localStorage.setItem('sound', 'mute');
  });
}

test('death count increase starts a ticking respawn timer', async ({ page }) => {
  await muteMatchAudio(page);

  const observedDeathFrames = createObservedDeathCountWindowFrames();
  await mockLiveMatchApis(page, {
    initialWindowFrame: observedDeathFrames[0],
    liveWindowFrames: observedDeathFrames,
  });

  await page.goto('/#/live/match-1/game-index/1');

  const deathTimer = page.getByTestId('player-death-timer-8');
  await expect(page.getByRole('button', { name: 'Copy Champion Names' })).toBeVisible();
  await expect(deathTimer).toBeVisible();

  const initialText = (await deathTimer.textContent()) || '';
  expect(initialText).toMatch(/^\u2620 (1:00|0:5\d)$/);

  await page.waitForTimeout(1200);

  const updatedText = (await deathTimer.textContent()) || '';
  expect(updatedText).toMatch(/^\u2620 0:5\d$/);
  expect(updatedText).not.toBe(initialText);
});

test('multi-death jump starts one respawn timer from the observed frame', async ({ page }) => {
  await muteMatchAudio(page);

  const observedDeathFrames = createMultiDeathJumpWindowFrames();
  await mockLiveMatchApis(page, {
    initialWindowFrame: observedDeathFrames[0],
    liveWindowFrames: observedDeathFrames,
  });

  await page.goto('/#/live/match-1/game-index/1');

  await expect(page.getByRole('button', { name: 'Copy Champion Names' })).toBeVisible();
  await expect(page.getByTestId('player-death-timer-8')).toContainText(/^\u2620 0:[4-5]\d$/);
});

test('death count increase starts a timer even when HP is full', async ({ page }) => {
  await muteMatchAudio(page);

  const observedDeathFrames = createFullHealthDeathCountWindowFrames();
  await mockLiveMatchApis(page, {
    initialWindowFrame: observedDeathFrames[0],
    liveWindowFrames: observedDeathFrames,
  });

  await page.goto('/#/live/match-1/game-index/1');

  await expect(page.getByRole('button', { name: 'Copy Champion Names' })).toBeVisible();
  await expect(page.getByTestId('player-death-timer-8')).toBeVisible();
});

test('initially observed deaths do not start a timer', async ({ page }) => {
  await muteMatchAudio(page);

  const initialDeathsFrame = createInitialDeathsWindowFrame();
  await mockLiveMatchApis(page, {
    initialWindowFrame: initialDeathsFrame,
    liveWindowFrames: [initialDeathsFrame],
  });

  await page.goto('/#/live/match-1/game-index/1');

  await expect(page.getByRole('button', { name: 'Copy Champion Names' })).toBeVisible();
  await expect(page.getByTestId('player-death-timer-8')).toHaveCount(0);
});

test('initial fast-loaded deaths do not start a timer', async ({ page }) => {
  await muteMatchAudio(page);

  const observedDeathFrames = createObservedDeathCountWindowFrames();
  await mockLiveMatchApis(page, {
    initialWindowFrame: observedDeathFrames[0],
    liveWindowFrames: [observedDeathFrames[1]],
  });

  await page.goto('/#/live/match-1/game-index/1');

  await expect(page.getByRole('button', { name: 'Copy Champion Names' })).toBeVisible();
  await expect(page.getByTestId('player-death-timer-8')).toHaveCount(0);
});

test('expired death timers disappear', async ({ page }) => {
  await muteMatchAudio(page);

  const observedDeathFrames = createExpiredDeathCountWindowFrames();
  await mockLiveMatchApis(page, {
    initialWindowFrame: createObjectiveTimerInitialWindowFrame(),
    liveWindowFrames: observedDeathFrames,
    liveWindowPollDelayMs: 250,
  });

  await page.goto('/#/live/match-1/game-index/1');

  await page.waitForTimeout(900);
  await expect(page.getByTestId('player-death-timer-8')).toHaveCount(0);
});

test('later death increases restart the timer', async ({ page }) => {
  await muteMatchAudio(page);

  const repeatedDeathFrames = createRepeatedDeathCountWindowFrames();
  await mockLiveMatchApis(page, {
    initialWindowFrame: repeatedDeathFrames[0],
    liveWindowFrames: repeatedDeathFrames.slice(1),
  });

  await page.goto('/#/live/match-1/game-index/1');

  await expect(page.getByRole('button', { name: 'Copy Champion Names' })).toBeVisible();
  await expect(page.getByTestId('player-death-timer-8')).toContainText(/^\u2620 0:[4-5]\d$/);
});

test('finished games hide death timers', async ({ page }) => {
  await muteMatchAudio(page);

  const observedDeathFrames = createObservedDeathCountWindowFrames();
  await mockLiveMatchApis(page, {
    initialWindowFrame: observedDeathFrames[0],
    liveWindowFrames: [
      observedDeathFrames[0],
      {
        ...observedDeathFrames[1],
        gameState: 'finished',
      },
    ],
  });

  await page.goto('/#/live/match-1/game-index/1');

  await expect(page.getByRole('button', { name: 'Copy Champion Names' })).toBeVisible();
  await expect(page.getByTestId('player-death-timer-8')).toHaveCount(0);
});
