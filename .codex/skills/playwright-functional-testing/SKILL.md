---
name: playwright-functional-testing
description: Use when working in this repo on browser-visible functionality, routing, interactive UI, regressions, or frontend bug fixes that should be validated in a real browser with Playwright. Apply it whenever a change adds, removes, or alters visible behavior on the schedule page, live match page, or shared navigation/components.
---

# Playwright Functional Testing

Use Playwright to validate browser-visible changes before finishing the task.

## Workflow

1. Decide whether the change affects visible behavior.
2. Add or update a focused Playwright spec for that behavior.
3. Prefer mocking LoL Esports and Data Dragon responses so tests stay deterministic.
4. Run the narrowest relevant Playwright command while iterating, then run broader coverage if the change touches shared flows.
5. Report the command you ran, what passed, and any remaining blind spots.

## Repo Conventions

- Use hash routes such as `#/live/:gameid`.
- Register `page.route()` handlers before navigation for live match tests.
- Assert on visible UI and regression-sensitive strings first. Use screenshots only when layout is the main risk.
- Keep selectors simple and user-facing when possible.

## Commands

- Run `npm run test:e2e` for the full suite.
- Run `npx playwright test tests/e2e/<spec>.spec.ts` for a targeted check.

## Reference

See [references/repo-notes.md](references/repo-notes.md) for the repo-specific mock targets and test commands.
