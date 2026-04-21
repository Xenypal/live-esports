import { expect, test } from '@playwright/test';

import { mockLiveMatchApis } from './helpers/liveMatchMocks';

test('live match gold displays include current item value', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('sound', 'mute');
  });

  await mockLiveMatchApis(page);

  await page.goto('/#/live/match-1/game-index/1');

  await expect(page.getByText('Copy Champion Names')).toBeVisible();
  await expect(page.getByTestId('blue-team-total-gold')).toHaveText('32,100 (2,250)');
  await expect(page.getByTestId('red-team-total-gold')).toHaveText('28,750 (2,250)');
  await expect(page.getByTestId('player-gold-1')).toHaveText('5,000 (450)');
  await expect(page.getByTestId('player-gold-6')).toHaveText('5,000 (450)');
});
