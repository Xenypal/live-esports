# Buffs And Spawns

This document explains how the current live match objective timers and Baron/Elder buff indicators work, what is exact vs inferred, and where the logic lives in the codebase.

## Summary

The live page currently tracks three related systems:

- neutral objective spawn / respawn timers
- team-wide Baron / Elder buff countdowns
- player-level Baron / Elder buff icons

All of this is derived from Riot live snapshot polling that already exists in the app. There is no separate Riot event log or per-player buff flag in the data we consume today.

The core design is:

- neutral objective timers are shown in the bottom objective strip
- team-wide Baron / Elder buff timers are shown by each team header
- player-level Baron / Elder buff icons are shown beside each summoner name

## What Riot Data We Actually Have

The app reads live snapshots from:

- `window/:gameId`
- `details/:gameId`

The timer / buff logic uses only the `WindowFrame` data in:

- [baseTypes.ts](C:/Users/legoe/Downloads/Python-Projects/Esports-Hosting/src/components/types/baseTypes.ts)

Important fields:

- `WindowFrame.rfc460Timestamp`
- `blueTeam.barons`
- `redTeam.barons`
- `blueTeam.dragons`
- `redTeam.dragons`
- `blueTeam.participants[*].currentHealth`
- `redTeam.participants[*].currentHealth`
- `blueTeam.participants[*].deaths`
- `redTeam.participants[*].deaths`

What Riot does **not** give us in this app:

- a true per-player Baron buff flag
- a true per-player Elder buff flag
- exact objective death timestamps if the page loads mid-buff
- a separate objective event feed

That means part of the system is exact, and part of it is inference.

## Spawn / Respawn Timer Logic

The neutral objective timer logic lives in:

- [objectiveTimers.ts](C:/Users/legoe/Downloads/Python-Projects/Esports-Hosting/src/components/Match/objectiveTimers.ts)

Main entry points:

- `advanceObjectiveTimeline(...)`
- `getObjectiveTimerNotes(...)`

Current standard timings used:

- Dragon first spawn: `5:00`
- Dragon respawn: `5:00`
- Baron first spawn: `20:00`
- Baron respawn: `6:00`
- Elder spawn: `6:00` after the 4th elemental
- Elder respawn: `6:00`
- Baron buff duration: `3:00`
- Elder buff duration: `2:30`

How it works:

1. The live page stores an `objectiveTimeline` object in `Game`.
2. Every time a new `lastWindowFrame` arrives, `advanceObjectiveTimeline(...)` compares the previous frame and current frame.
3. If dragon count increases, it records the next dragon respawn or elder spawn window.
4. If baron count increases, it records the next Baron respawn and the team buff expiration.
5. If elder count increases, it records the next Elder respawn and the team buff expiration.

The bottom strip is rendered from:

- `getObjectiveTimerNotes(...)`

That strip shows only neutral objectives:

- Dragon
- Baron
- Elder

If the objective should be up, the strip shows:

- `ALIVE`

If it is before first spawn or between deaths and respawns, it shows:

- a countdown

### Smooth Local Countdown

The timers do not wait for Riot to send a new frame every second.

Instead, in:

- [Game.tsx](C:/Users/legoe/Downloads/Python-Projects/Esports-Hosting/src/components/Match/Game.tsx)

the page creates a local clock:

- `displayFrameClockMs`

That clock is anchored to the latest Riot frame timestamp and then advanced locally every `250 ms`. This gives smooth countdown behavior even though Riot frames arrive less often.

## Team-Wide Buff Timer Logic

Team buff timer logic also lives in:

- [objectiveTimers.ts](C:/Users/legoe/Downloads/Python-Projects/Esports-Hosting/src/components/Match/objectiveTimers.ts)

Main entry point:

- `getTeamBuffTimerNotes(...)`

These timers are rendered by:

- [Game.tsx](C:/Users/legoe/Downloads/Python-Projects/Esports-Hosting/src/components/Match/Game.tsx)

UI location:

- `team-buff-strip`
- one strip beside each team header

These chips show:

- `TEAM Baron Buff`
- `TEAM Elder Buff`

with a countdown until the buff naturally expires.

### Exact vs Estimated Team Buff Timers

There are two modes:

#### 1. Confirmed / exact

If the page **observes** the Baron or Elder take live in-session, the timer is exact.

Example:

- previous frame: Blue Baron count `0`
- current frame: Blue Baron count `1`

Then we know:

- the buff started at the current frame timestamp
- the expiration is exactly:
  - `+180s` for Baron
  - `+150s` for Elder

These chips are marked internally as:

- `certainty: "certain"`

#### 2. Best-effort estimated

If the page loads mid-game and the team already has Baron / Elder on the snapshot, we do not know the real take timestamp.

In that case, we still show a best-effort countdown using the earliest guaranteed timing window allowed by the standard spawn / respawn rules.

These chips are marked internally as:

- `certainty: "estimated"`

In the UI they are shown as approximate:

- prefixed with `~`

Example:

- `~1:28`

This is not exact, but it gives a useful betting-oriented estimate.

## Player-Level Buff Icon Logic

Player-level buff indicator logic lives in:

- [objectiveTimers.ts](C:/Users/legoe/Downloads/Python-Projects/Esports-Hosting/src/components/Match/objectiveTimers.ts)

Main entry point:

- `getPlayerBuffIndicators(...)`

Rendered in:

- [Game.tsx](C:/Users/legoe/Downloads/Python-Projects/Esports-Hosting/src/components/Match/Game.tsx)

Visual component:

- `PlayerBuffBadges(...)`

UI location:

- next to each summoner name in the player row

### Confirmed player buff assignment

If the app observes a Baron or Elder take live:

1. The capturing team is known from the team counter increase.
2. Every player on that team with `currentHealth > 0` in that capture frame gets the buff.
3. Any player who is dead in that frame gets no buff.

This is stored in `objectiveTimeline.playerBuffs`.

Those icons are shown as colored / confirmed:

- Baron: purple-ish
- Elder: orange-ish

### Losing a buff

After a player has a tracked buff:

- if they die later, the icon is removed immediately
- if they respawn later, the icon is **not** restored

This matches the intended rule:

- dead on capture => no buff
- die after capture => lose buff permanently

That removal is handled in:

- `removeLostPlayerBuffs(...)`

### Estimated player buffs on mid-session load

If the page loads and a team already appears to have Baron / Elder active, but the capture was not observed:

- alive players on that team get a best-effort buff icon
- dead players do not get one

These icons are marked:

- `certainty: "estimated"`

In the UI they are shown in black / monochrome instead of color.

This keeps the information visible without pretending it is fully confirmed.

## Where The UI Lives

Main rendering file:

- [Game.tsx](C:/Users/legoe/Downloads/Python-Projects/Esports-Hosting/src/components/Match/Game.tsx)

Relevant parts:

- `objectiveTimerNotes`
  - bottom objective strip
- `teamBuffTimerNotes`
  - team header buff chips
- `playerBuffIndicators`
  - player row buff icons
- `PlayerBuffBadges(...)`
  - icon renderer for each player row

Styles live in:

- [playerStatusStyle.css](C:/Users/legoe/Downloads/Python-Projects/Esports-Hosting/src/components/Match/styles/playerStatusStyle.css)

Important classes:

- `objective-timer-strip`
- `objective-timer-pill`
- `team-buff-strip`
- `team-buff-pill`
- `player-buff-badges`
- `player-buff-badge`

## How We Extrapolate / Infer

Because Riot does not give us a per-player buff flag in this flow, we infer using:

- team Baron / Elder count changes
- local frame timestamps
- player alive / dead state
- player death increases between frames

The inference rules are intentionally conservative:

- confirmed live observation gets colored icons and exact timers
- unobserved mid-session state gets black icons and approximate team timers
- dead players never show active Baron / Elder buff icons
- a player who dies loses the tracked buff and never regains it

## Current Limitations

These are known limitations of the current approach:

- if the page opens mid-buff, we cannot reconstruct the true exact take timestamp
- estimated player icons may be wrong in edge cases if a player was dead at take time but alive when the page first loaded
- estimated team countdowns are approximate, not authoritative
- if Riot’s live feed itself lags or skips, local timers remain smooth but still depend on the last known frame anchor

## Tests

The current mocked Playwright coverage lives in:

- [live-match-objective-timers.spec.ts](C:/Users/legoe/Downloads/Python-Projects/Esports-Hosting/tests/e2e/live-match-objective-timers.spec.ts)

The mock frame builders live in:

- [liveMatchMocks.ts](C:/Users/legoe/Downloads/Python-Projects/Esports-Hosting/tests/e2e/helpers/liveMatchMocks.ts)

Covered scenarios:

- Dragon / Baron pre-spawn countdowns
- Dragon / Baron alive state
- Team buff timers moved to team headers
- Confirmed Baron buff icons disappearing on death and staying gone after revive
- Estimated mid-session Baron buff timers and monochrome player icons

## Practical Reading Guide

If you want to trace the system quickly, read in this order:

1. [objectiveTimers.ts](C:/Users/legoe/Downloads/Python-Projects/Esports-Hosting/src/components/Match/objectiveTimers.ts)
2. [Game.tsx](C:/Users/legoe/Downloads/Python-Projects/Esports-Hosting/src/components/Match/Game.tsx)
3. [live-match-objective-timers.spec.ts](C:/Users/legoe/Downloads/Python-Projects/Esports-Hosting/tests/e2e/live-match-objective-timers.spec.ts)

That gives you:

- the state machine
- the UI wiring
- the mocked regression scenarios
