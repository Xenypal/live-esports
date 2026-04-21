import { expect, test } from '@playwright/test';

import {
  createAliveObjectiveWindowFrames,
  createBlueDragonWindowFrames,
  createEstimatedBaronInitialWindowFrame,
  createEstimatedBaronBuffWindowFrames,
  createObservedBaronBuffWindowFrames,
  createObjectiveTimerInitialWindowFrame,
  createObjectiveTimerWindowFrames,
  createPreSpawnObjectiveWindowFrames,
  createSoulClinchObjectiveWindowFrames,
  createSplitDragonObjectiveWindowFrames,
  mockLiveMatchApis,
} from './helpers/liveMatchMocks';

test('objective footer countdowns tick locally with icons', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('sound', 'mute');
  });

  await mockLiveMatchApis(page, {
    liveWindowFrames: createPreSpawnObjectiveWindowFrames(),
  });

  await page.goto('/#/live/match-1/game-index/1');

  await expect(page.getByText('Copy Champion Names')).toBeVisible();
  await expect(page.getByTestId('objective-timer-strip')).toBeVisible();

  const dragonNote = page.getByTestId('objective-note-dragon');
  const baronNote = page.getByTestId('objective-note-baron');

  await expect(dragonNote).toContainText('Dragon');
  await expect(dragonNote).toContainText('0:30');
  await expect(dragonNote.locator('svg')).toBeVisible();

  await expect(baronNote).toContainText('Baron');
  await expect(baronNote).toContainText('15:30');
  await expect(baronNote.locator('svg')).toBeVisible();

  await page.waitForTimeout(1200);

  await expect(dragonNote).toContainText('0:29');
  await expect(baronNote).toContainText('15:29');
});

test('objective footer keeps dragon and baron visible as alive', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('sound', 'mute');
  });

  await mockLiveMatchApis(page, {
    liveWindowFrames: createAliveObjectiveWindowFrames(),
  });

  await page.goto('/#/live/match-1/game-index/1');

  await expect(page.getByText('Copy Champion Names')).toBeVisible();
  await expect(page.getByTestId('objective-timer-strip')).toBeVisible();
  await expect(page.getByTestId('objective-note-dragon')).toContainText('Dragon');
  await expect(page.getByTestId('objective-note-dragon')).toContainText('ALIVE');
  await expect(page.getByTestId('objective-note-baron')).toContainText('Baron');
  await expect(page.getByTestId('objective-note-baron')).toContainText('ALIVE');
});

test('objective timer strip sits above the footer buttons and uses larger timer text', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('sound', 'mute');
  });

  await mockLiveMatchApis(page, {
    liveWindowFrames: createAliveObjectiveWindowFrames(),
  });

  await page.goto('/#/live/match-1/game-index/1');

  const objectiveStrip = page.getByTestId('objective-timer-strip');
  const footerActions = page.getByTestId('match-footer-actions');
  const dragonStatus = page.getByTestId('objective-note-dragon').locator('.objective-timer-status');

  await expect(objectiveStrip).toBeVisible();
  await expect(footerActions).toBeVisible();

  const [objectiveStripBox, footerActionsBox] = await Promise.all([
    objectiveStrip.boundingBox(),
    footerActions.boundingBox(),
  ]);

  expect(objectiveStripBox).not.toBeNull();
  expect(footerActionsBox).not.toBeNull();
  expect(objectiveStripBox!.y).toBeLessThan(footerActionsBox!.y);

  const objectiveStatusFontSize = await dragonStatus.evaluate(element => (
    window.getComputedStyle(element).fontSize
  ));
  expect(objectiveStatusFontSize).toBe('14px');
});

test('objective footer keeps dragon as the next objective until a team reaches soul', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('sound', 'mute');
  });

  await mockLiveMatchApis(page, {
    initialWindowFrame: createObjectiveTimerInitialWindowFrame(),
    liveWindowFrames: createSplitDragonObjectiveWindowFrames(),
  });

  await page.goto('/#/live/match-1/game-index/1');

  await expect(page.getByRole('button', { name: 'Copy Champion Names' })).toBeVisible();
  await expect(page.getByTestId('objective-note-dragon')).toContainText('Dragon');
  await expect(page.getByTestId('objective-note-elder')).toHaveCount(0);
});

test('objective footer switches to elder only after the soul-clinching dragon', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('sound', 'mute');
  });

  await mockLiveMatchApis(page, {
    initialWindowFrame: createObjectiveTimerInitialWindowFrame(),
    liveWindowFrames: createSoulClinchObjectiveWindowFrames(),
  });

  await page.goto('/#/live/match-1/game-index/1');

  await expect(page.getByRole('button', { name: 'Copy Champion Names' })).toBeVisible();
  await expect(page.getByTestId('objective-note-elder')).toContainText('Elder');
  await expect(page.getByTestId('objective-note-elder')).toContainText('6:00');
  await expect(page.getByTestId('objective-note-dragon')).toHaveCount(0);
});

test('live match footer keeps team buffs by the team header and not in the objective strip', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('sound', 'mute');
  });

  await mockLiveMatchApis(page, {
    liveWindowFrames: createObjectiveTimerWindowFrames(),
  });

  await page.goto('/#/live/match-1/game-index/1');

  await expect(page.getByText('Copy Champion Names')).toBeVisible();
  await expect(page.getByTestId('objective-timer-strip')).toBeVisible();
  await expect(page.getByTestId('objective-timer-strip')).not.toContainText('FLY Elder Buff');
  await expect(page.getByTestId('team-buff-note-blue-elder-buff')).toContainText('FLY Elder Buff');
  await expect(page.getByTestId('team-buff-note-blue-elder-buff')).toContainText(/2:2\d|2:30/);
  await expect(page.getByTestId('objective-note-elder')).toContainText('Elder');
  await expect(page.getByTestId('objective-note-elder')).toContainText('6:00');
  await expect(page.getByTestId('objective-note-baron')).toContainText('Baron');
  await expect(page.getByTestId('objective-note-baron')).toContainText('ALIVE');
  await expect(page.getByTestId('player-buff-1-elder')).toBeVisible();
});

test('confirmed baron buff badges disappear on death and stay gone after revive', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('sound', 'mute');
  });

  await mockLiveMatchApis(page, {
    liveWindowFrames: createObservedBaronBuffWindowFrames(),
  });

  await page.goto('/#/live/match-1/game-index/1');

  await expect(page.getByText('Copy Champion Names')).toBeVisible();
  await expect(page.getByTestId('team-buff-note-blue-baron-buff')).toContainText('Baron Buff');
  await expect(page.getByTestId('player-buff-1-baron')).toBeVisible();
  await expect(page.getByTestId('player-buff-2-baron')).toBeVisible();

  await page.waitForTimeout(1200);

  await expect(page.getByTestId('player-buff-2-baron')).toHaveCount(0);
  await expect(page.getByTestId('player-buff-1-baron')).toBeVisible();
});

test('estimated mid-session baron buffs render as approximate header timers and black icons', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('sound', 'mute');
  });

  await mockLiveMatchApis(page, {
    initialWindowFrame: createEstimatedBaronInitialWindowFrame(),
    liveWindowFrames: createEstimatedBaronBuffWindowFrames(),
  });

  await page.goto('/#/live/match-1/game-index/1');

  await expect(page.getByText('Copy Champion Names')).toBeVisible();
  const blueBaronTimer = page.getByTestId('team-buff-note-blue-baron-buff-estimated');
  const estimatedPlayerBuff = page.getByTestId('player-buff-1-baron');

  await expect(blueBaronTimer).toContainText('FLY Baron Buff');
  await expect(blueBaronTimer).toContainText(/~1:(2\d|30)/);
  await expect(estimatedPlayerBuff).toBeVisible();
  await expect(estimatedPlayerBuff).toHaveClass(/estimated/);
});

test('finished games hide objective buff timers and player buff badges', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('sound', 'mute');
  });

  await mockLiveMatchApis(page, {
    liveWindowFrames: createBlueDragonWindowFrames(),
  });

  await page.goto('/#/live/match-1/game-index/1');

  await expect(page.getByText('Copy Champion Names')).toBeVisible();
  await expect(page.getByTestId('objective-timer-strip')).toHaveCount(0);
  await expect(page.getByTestId('blue-team-buff-strip')).toHaveCount(0);
  await expect(page.getByTestId('red-team-buff-strip')).toHaveCount(0);
  await expect(page.getByTestId('player-buff-1-elder')).toHaveCount(0);
  await expect(page.getByTestId('player-buff-1-baron')).toHaveCount(0);
});
