import { expect, test } from '@playwright/test';

import { createAmbiguousBlueKillWindowFrames, createBlueDragonWindowFrames, createBlueKillWindowFrames, createCompletedEventDetails, createGameEndedWindowFrames, createInProgressEventDetails, mockLiveMatchApis } from './helpers/liveMatchMocks';

test('live match notifications keep their text visible', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('sound', 'mute');
  });

  await mockLiveMatchApis(page, {
    liveWindowFrames: createBlueKillWindowFrames(),
  });

  await page.goto('/#/live/match-1/game-index/1');

  const toast = page.locator('.Toastify__toast').filter({ hasText: 'Killed Ahri' }).first();
  const message = toast.locator('.toast-message');

  await expect(message).toBeVisible();
  await expect(message).toHaveText('Killed Ahri');
  const teamLogo = toast.getByRole('img', { name: 'FlyQuest' });
  await expect(teamLogo).toBeVisible();

  const colors = await toast.evaluate(node => {
    const messageElement = node.querySelector<HTMLElement>('.toast-message');
    if (!messageElement) {
      throw new Error('Toast message element was not rendered.');
    }

    return {
      messageColor: window.getComputedStyle(messageElement).color,
      toastColor: window.getComputedStyle(node).color,
    };
  });

  expect(colors.messageColor).toBe(colors.toastColor);

  const logoBacking = await teamLogo.evaluate(node => {
    const styles = window.getComputedStyle(node);

    return {
      backgroundColor: styles.backgroundColor,
      objectFit: styles.objectFit,
    };
  });

  expect(logoBacking).toEqual({
    backgroundColor: 'rgb(0, 0, 0)',
    objectFit: 'contain',
  });
});

test('live match notifications fall back to team wording for ambiguous multikills', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('sound', 'mute');
  });

  await mockLiveMatchApis(page, {
    liveWindowFrames: createAmbiguousBlueKillWindowFrames(),
  });

  await page.goto('/#/live/match-1/game-index/1');

  const toast = page.locator('.Toastify__toast').filter({ hasText: 'Blue team got 2 kills' }).first();
  await expect(toast.locator('.toast-message')).toHaveText('Blue team got 2 kills');
  await expect(toast.getByRole('img', { name: 'FlyQuest' })).toBeVisible();
});

test('live match dragon notifications use dragon type and faster animation timing', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('sound', 'mute');
  });

  await mockLiveMatchApis(page, {
    liveWindowFrames: createBlueDragonWindowFrames(),
  });

  await page.goto('/#/live/match-1/game-index/1');

  const toast = page.locator('.Toastify__toast').filter({ hasText: 'Defeated the elder dragon' }).first();
  await expect(toast.locator('.toast-message')).toHaveText('Defeated the elder dragon');
  await expect(toast.getByRole('img', { name: 'FlyQuest' })).toBeVisible();

  const animationDuration = await toast.evaluate(node => window.getComputedStyle(node).animationDuration);
  expect(animationDuration).toBe('0.525s');
});

test('live match game ended banner appears immediately and resolves the official winner name', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('sound', 'mute');
  });

  await mockLiveMatchApis(page, {
    eventDetailsResponses: [
      createInProgressEventDetails(),
      createCompletedEventDetails(),
    ],
    initialWindowFrame: createGameEndedWindowFrames()[0],
    liveWindowFrames: createGameEndedWindowFrames(),
  });

  await page.goto('/#/live/match-1/game-index/1');

  const banner = page.getByTestId('game-ended-banner');
  await expect(banner).toBeVisible();
  await expect(banner).toContainText('GAME ENDED');
  await expect(page.getByTestId('game-ended-winner')).toHaveText('FlyQuest WON');

  const toast = page.locator('.Toastify__toast').filter({ hasText: 'Game Ended' }).first();
  await expect(toast).toBeVisible();
});
