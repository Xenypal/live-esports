# Repo Notes

Use these commands:

- `npm run test:e2e` for the full Playwright suite.
- `npx playwright test tests/e2e/<spec>.spec.ts` for a targeted run while iterating.

Favor mocked network responses for live route coverage. The main browser-side requests for `#/live/:gameid` are:

- `getEventDetails`
- `getSchedule`
- `getStandings`
- `window/:gameId`
- `details/:gameId`
- Data Dragon item and rune JSON

Register `page.route()` handlers before `page.goto()` so the app never races the live APIs.
