import { expect, test } from '@playwright/test';

import { mockLiveMatchApis } from './helpers/liveMatchMocks';

test('live match page keeps stats UI and removes stream/chat features', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('stream', 'enabled');
    localStorage.setItem('chat', 'enabled');
    localStorage.setItem('sound', 'mute');
  });

  await mockLiveMatchApis(page);
  await page.goto('/#/live/match-1/game-index/1');

  await expect(page.getByText('FlyQuest').first()).toBeVisible();
  await expect(page.getByText('Team Liquid').first()).toBeVisible();
  await expect(page.getByText('Patch Version: 14.3.1')).toBeVisible();
  await expect(page.getByText('Copy Champion Names')).toBeVisible();

  await expect(page.getByText('Stream Enabled')).toHaveCount(0);
  await expect(page.getByText('Chat Enabled')).toHaveCount(0);
  await expect(page.getByText('No VODS currently available')).toHaveCount(0);
  await expect(page.locator('iframe')).toHaveCount(0);

  await expect
    .poll(() =>
      page.evaluate(() => ({
        chat: localStorage.getItem('chat'),
        stream: localStorage.getItem('stream'),
      })),
    )
    .toEqual({
      chat: null,
      stream: null,
    });
});
