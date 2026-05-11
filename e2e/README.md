# E2E Testing Architecture (Playwright)

## Goals

- Keep tests stable during UI refactors.
- Make failures actionable and localized.
- Separate setup, test intent, and selector details.

## Structure

- `e2e/config/` runtime test configuration.
- `e2e/support/` auth state and test data builders.
- `e2e/fixtures/` shared Playwright fixtures.
- `e2e/pages/` page objects (single place for locators and UI actions).
- `e2e/tests/smoke/` fast route and baseline health checks.
- `e2e/tests/feature/` business scenarios by domain.

## Stability Principles

- Prefer `role`, `label`, and route assertions over CSS selectors.
- Keep all locator changes inside page objects.
- Use API-based auth bootstrap (`auth.setup.ts`) instead of UI registration in each test.
- Keep tests isolated by generating unique user and entity names.
- Validate business outcomes (URL, visible state, created entity), not implementation details.

## Test Layers

1. Smoke: app availability and core navigation.
2. Feature: end-to-end user scenarios (auth, prompts, testcases).
3. Future extension: contract/API checks through Playwright request context for critical endpoints.

## Running

```bash
pnpm exec playwright test
```

Docker e2e mode:

```bash
E2E=true pnpm exec playwright test
```

Optional overrides:

- `E2E_WEB_URL` (default: `http://localhost:3080` or `4080` in E2E mode)
- `E2E_API_URL` (default: `http://localhost:3010` or `4010` in E2E mode)

## Conventions For New Tests

- Add locators/actions only in `e2e/pages/*`.
- Add setup helpers in `e2e/support/*`.
- Keep one behavior per test and name it from user perspective.
- Use `test.step` for readable reporting.
