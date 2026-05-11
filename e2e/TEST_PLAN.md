# Full E2E Coverage Plan (Playwright)

## Scope

- Auth
- Workspace routing (organization/project context)
- Prompts lifecycle
- Testcases lifecycle
- Files and file-to-testcase linkage
- Versions/compare/rollback
- Memory tab
- Logs (project and prompt)
- Settings (user/org/project)
- Notifications

## Required suites

1. `smoke/*`
- App loads for authenticated user.
- Core left navigation works.
- Workspace switch keeps app usable.

2. `feature/auth/*`
- Logout/login roundtrip.
- Protected route redirects unauthenticated user to login.

3. `feature/prompts/*`
- Create, rename, run, delete prompt.
- Generate prompt content and accept diff.
- Commit flow and versions visibility.

4. `feature/testcases/*`
- Add testcase from output.
- Run testcase and verify status transitions.
- Update expected output and assertion.

5. `feature/files/*`
- Upload file.
- Attach file to testcase.
- Remove file from testcase.

6. `feature/versions/*`
- Commit history visible.
- Compare two versions.
- Rollback updates prompt content.

7. `feature/memory/*`
- Create/update/delete memory entries.

8. `feature/logs/*`
- Prompt run appears in logs table.
- Log filters return stable result set.

9. `feature/settings/*`
- Update user profile.
- Organization/project details screens open.
- API keys create/delete flows (where allowed).

10. `feature/notifications/*`
- List and details routes open.
- Mark-as-read behavior.

## Stability Rules

- Do not assert exact text for cosmetic UI unless it is business-critical.
- Assert route intent and outcome state.
- Keep all selectors in page objects.
- Use API setup for auth and prerequisite data when possible.
- Use unique test data and avoid shared mutable fixtures.

## Exit Criteria

- Smoke suite passes on each PR.
- Feature suites run nightly and on release branches.
- No flaky test above 1% failure rate over 20 recent runs.
