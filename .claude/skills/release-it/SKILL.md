---
name: release-it
description: Use when cutting a release of genum — the user asks to publish a new version, cut a patch/minor/major, or invokes /release-it with or without a bump type (patch/minor/major/explicit version), in any language. Runs the pre-flight the CI cannot, drafts release notes in this repo's established style, then hands the interactive release-it command to the user.
---

# release-it (genum)

## Overview

Driver for `release-it`, configured under the `release-it` key in the root `package.json`. This skill does **only** what release-it does not: pre-flight checks, and a release-notes draft in this repository's house style. The version bump, commit, tag, push and GitHub release are all still performed by `release-it` **interactively, in the user's own terminal**.

**Iron rule #1 — never `--ci`, never `--dry-run --ci`, never any flag that skips a prompt.** The user confirms commit, tag, push and release individually.

**Iron rule #2 — you cannot run `release-it` yourself.** It needs a real TTY. The Bash tool has none, and neither does the `!` prefix — both go through the Claude Code harness. The first prompt (`Commit (chore: release vX.Y.Z)?`) reads `null`, release-it aborts with `User force closed the prompt`, and it rolls back the version bump it already wrote to five files. Print the command; the user runs it in iTerm / Terminal.

**Iron rule #3 — run the gates locally first. This repo cannot catch a bad release any other way.**
`.github/workflows/docker-release.yml` triggers on `release: published`, so its `test-and-lint` job runs **after** the tag and the GitHub release already exist. The only required check on `main` is `license_check`; type-check, tests, lint and the web build run nowhere else. `release-it` here has **no `before:init` hooks**, so it will happily tag a branch that does not compile. If the gates fail after publishing, you get a published release with no Docker images. Step 1 is not optional.

## Arguments

| Input | Pass to release-it |
|---|---|
| `patch` / "patch release" / nothing | `patch` |
| `minor` / "minor release" | `minor` |
| `major` | `major` |
| Explicit `1.9.0` | `1.9.0` |

Stable releases must come from `main` — the workflow's job guard requires `target_commitish == 'main'`, so a tag pushed from any other branch publishes a release and builds **no images at all**.

Pre-releases are possible but only from `main`: the same guard applies, and `is_prerelease` merely skips the `latest` Docker tag. There is no feature-branch pre-release path in this repo. If the user asks for one, say so rather than improvising flags.

## Procedure

Stop on the first failure and report it. Do not work around a failed gate.

### 1. Pre-flight

```bash
git rev-parse --abbrev-ref HEAD          # must be main
git fetch origin
git status --porcelain                   # must be empty
git rev-list --left-right --count main...origin/main   # must be "0 0"
gh pr list --state open --json number,title,author --limit 50
```

- **Not on `main`** → stop, offer to switch. Never auto-switch; they may have work in progress.
- **Dirty tree** → list the files and stop. Never stash.
- **Diverged** → say which side is ahead. Stop.
- **Open PRs** → list them and say they will not be in this release unless merged first. Ask; do not block.

Then the gates the release workflow only runs afterwards:

```bash
pnpm install --frozen-lockfile
rm -rf packages/*/dist                    # see below — this is not optional
pnpm turbo run type-check --filter=core   # must exit 0
pnpm turbo run test:run --filter=core     # all green
pnpm biome check apps/core                # this is what test-and-lint runs
pnpm --filter web build                   # the only type-check web has
```

**Run the gates against a tree with no built workspace packages.** Every entry point of
`@genum/placeholders` resolves into its `dist/`, and CI checks out clean and never builds
it. A developer's tree almost always has a warm `dist/` from an earlier `pnpm build`, so
the gates pass locally and the same commit fails in CI. This is not hypothetical: v1.10.0
was published this way, three suites failed in `test-and-lint`, and no images were built.
Delete `packages/*/dist` first, and go through turbo so the build actually happens —
`pnpm --filter core test:run` calls vitest directly and skips the task graph.

`pnpm lint` is red on `main` by long-standing baseline — do not treat it as a release blocker. See the `verifying-changes` skill for the numbers.

### 2. Draft the notes

```bash
LAST_TAG=$(git describe --tags --abbrev=0)
git log "$LAST_TAG"..HEAD --pretty=format:'%h%x09%s' --no-merges
```

Watch for commits that landed **after** the previous release commit — `chore: release vX.Y.Z` is often not the last commit on the tag, so a merged PR can already be sitting unreleased on `main`. Include those.

For every PR in range, read its body (`gh pr view <n> --json title,body`) — this repo's notes explain *why* a change matters, and the PR body is where that reasoning lives.

**House style, matching v1.7.0 and v1.8.0.** Emoji section headers; inside each, a **bold sentence-style title** followed by the PR number, then a **prose paragraph** — not bullets. Two to five sentences that describe what an operator or user now experiences. Bullets appear only under `### ⚠️ Upgrading`.

Sections, in this order, omitting any that is empty:

```markdown
### ✨ New

**Short title of the change** (#PR)
Prose paragraph. What it does, what it means for the user, how to switch it on if that applies.

### 🐛 Fixed

**Short title** (#PR)
Prose paragraph. What was broken, what the symptom was, what happens now.

### 🔒 Security

**Short title** (#PR)
Prose. State impact plainly so operators know whether to upgrade urgently. Do not include
reproduction steps, payloads or an exploitation path — this repository is public and the
release notes are the first thing an attacker reads.

### 🛠 Tooling

**Short title** (#PR)
Developer-facing scripts, CI, build pipeline, skills.

### ⚠️ Upgrading

- Bullets here, not prose. One per action the operator must take or watch for.
```

Rules:

- **No commit SHAs**, no `Full changelog` link — past releases in this repo have neither.
- **No summary paragraph at the top.** Releases here open directly with `### ✨ New` or whatever the first section is.
- **English only**, whatever language the conversation is in.
- **Outcome, not commit subject.** `fix(core): scope deleteProjectApiKeyById` → "Project API keys could be deleted across projects."
- **One PR, one entry.** Cluster several commits from one PR into a single paragraph.
- Skip merge commits, `chore: release vX.Y.Z`, and pure-internal churn with no observable effect.

`### ⚠️ Upgrading` — include an entry whenever any of these is true, quoting the exact command or file:

- **A Prisma migration was added** (`apps/core/prisma/migrations/`). Docker deployments apply it on container start, because `docker-entrypoint.sh` runs `db-init`; a non-Docker deployment must run `prisma migrate deploy` before starting the new build. Say both.
- **An `.env` variable was added, renamed or made required** (`apps/core/src/env.ts` changed).
- **Behaviour an operator already depends on changed** — key resolution, auth mode, default model, role requirements.
- **The Node or pnpm floor moved.**
- **Credentials may need rotating** because of a fixed disclosure.

If none applies, omit the section. Do not invent one.

Show the draft and ask whether to edit before releasing.

### 3. Hand the command to the user

Write the approved notes to a file with the Write tool, then print the command. Do **not** run it.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
▶  RUN THIS IN YOUR TERMINAL (needs a real TTY)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

```
GITHUB_TOKEN=$(gh auth token) pnpm exec release-it <bump> --github.releaseNotes="cat <NOTES_FILE>"
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

The `━` rules and the label are plain lines outside the fence; only the command goes inside it, or the user copies the banner along with it.

Notes on that command:

- **`--github.releaseNotes` takes a shell command whose stdout becomes the body — not a string.** Pass `"cat $NOTES_FILE"`. Passing `"$(cat …)"` makes the shell evaluate the markdown's backticks and parentheses and the release aborts.
- **`GITHUB_TOKEN` is required** because the release is created through the API, not the browser form. `$(gh auth token)` reuses the user's existing `gh` login; never echo, paste or store the value.
- There is no `release` script in `package.json` — `pnpm exec release-it` is correct here.

release-it then, in the user's terminal: bumps the version in the root `package.json`, both app `package.json` files and both `src/constants/VERSION.ts` files via `@release-it/bumper`; prompts for commit, tag, push; and creates the GitHub release as a **draft**, printing its URL.

### 4. After it exits

```bash
git tag --sort=-v:refname | head -3
```

Confirm the new tag, and give the user the draft release URL to review and publish.

**Publishing is what starts the deploy.** `docker-release.yml` fires on `release: published`, not on the tag, so nothing is built while the release is a draft. Once published it builds and pushes `core` and `web` images for `linux/amd64` and `linux/arm64` to Docker Hub, tagging `latest` too unless the release is marked pre-release, and creates the Sentry releases. Watch it with `gh run watch` or `gh run list --workflow=docker-release.yml --limit 1`.

## Failure modes

| Symptom | Cause | Fix |
|---|---|---|
| `User force closed the prompt with 0 null` at the first prompt | release-it launched without a TTY — via the Bash tool or the `!` prefix | The user runs it in their own terminal. Never invoke it for them. |
| `bad url`, or the release page refuses to open | `github.web` was set back to `true`; the body travels in a query string capped at ~8 KB, and percent-encoding roughly doubles it | Keep `github.web: false` + `github.draft: true`. Never shorten good notes to fit a URL. |
| `401` / `Bad credentials` creating the release | `GITHUB_TOKEN` unset — the API path needs it, the old web path did not | Prefix with `GITHUB_TOKEN=$(gh auth token)`; check `gh auth status`. |
| Shell syntax error mid-release | Notes passed as `--github.releaseNotes="$(cat …)"` | Pass the command form: `"cat $NOTES_FILE"`. |
| Release published, no Docker images built | Tag not on `main`, or `target_commitish != 'main'` | Stable releases only from `main`. Check the run's job guard. |
| `test-and-lint` fails in the workflow | A gate was skipped in step 1 | The release is already public. Fix forward and cut the next patch — the images were never pushed. |
| Working tree dirty right after the bump | A `@release-it/bumper` `out` path is gitignored or missing | Check all five `out` paths in the root `package.json` still exist. |
| Version files out of sync afterwards | Someone edited a `VERSION.ts` by hand | Never hand-edit; the bumper owns all five files. |

## Red flags — STOP

- About to pass `--ci`, `-y`, or any prompt-skipping flag → don't.
- About to run `release-it` through the Bash tool, or to tell the user to run it with `!` → don't. No TTY.
- About to `git tag` or `git push --tags` by hand → don't; release-it owns that.
- About to skip the local gates because "CI will catch it" → it will not, and only after publishing. Run them.
- About to set `github.web: true` → that is the ~8 KB URL trap.
- About to put reproduction steps for a fixed vulnerability into the notes → don't; the repo is public.
- About to write the notes in Russian, or open them with a summary paragraph → neither matches this repo.
- About to cut a stable release from a branch other than `main` → the workflow will publish it and build nothing.
