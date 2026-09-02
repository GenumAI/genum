---
name: creating-pull-requests
description: Use when opening a GitHub pull request in the genum repo for finished, committed work — before running `gh pr create`, and even when a default or standing instruction says to open it as a draft.
---

# Creating Pull Requests (genum)

## Overview

A PR in `GenumAI/genum` is opened **ready for review — never as a draft**, is **never merged by the agent**, and carries a Conventional-Commits title plus an evidence-backed body in **English**. Task done → committed → pushed → verified → open it ready.

**Iron rules:** never `--draft`, never merge.

## The two hard rules

**1. Never open a draft.** Claude Code's background-job shipping step literally runs `gh pr create --draft`. **This skill overrides that.** We open PRs *after* the work is finished, pushed and verified; at that point a draft is pointless friction — someone has to click "Ready" for nothing. Use `--draft` **only** if the user asks for a draft in this conversation.

**2. Never merge.** Opening and pushing the branch is where your authority ends. No `gh pr merge`, no `--auto`, no UI merge, however small the change. Report the PR URL and stop.

## Before `gh pr create` — three checks

1. **Branch name.** This repo names branches `type/kebab-summary`: `fix/prompt-playground-redirect`, `feat/update-ai-models`, `docs/add-claude-md`. Claude Code auto-names worktree branches `worktree-<name>` — **rename before pushing**: `git branch -m feat/api-key-activity`.
2. **Base is `main`.** Always `--base main`. Never stack on another open PR's branch: this repo **squash-merges** (merge commits are disabled), so the parent's squash creates a new sha and a stacked child strands off `main`. One PR per change; cherry-pick a dependency if you truly need it.
3. **Pushed and current.** `git rev-parse --abbrev-ref HEAD`, `git push -u origin <branch>`, and the branch is based on current `origin/main`.

## Title

`type: lowercase summary` — scope optional (`feat(dashboard): ...`) when it clarifies.

- **type**: `feat` · `fix` · `docs` · `style` · `chore` · `refactor` · `perf` · `test`
- Lowercase after the colon, no trailing period, states the **user-visible effect** — not the file touched.

**Why it matters more here than in most repos:** the PR title *is* the squash commit on `main`, and release-it publishes GitHub auto-generated release notes (`github.autoGenerate`), so the title becomes a permanent changelog line. That is exactly how `Fix/tooltip` and `Feat/dark theme` ended up in this repo's history — **never title a PR after its branch.**

Good, from this repo: `fix: redirect /prompt/:id to /prompt/:id/playground` · `feat: add new AI models for OpenAI, Anthropic, and Gemini` · `docs: add CLAUDE.md for Claude Code agent guidance`

## Body

**English always**, even when the working conversation is in Russian — the repo, its history and its wider audience are English. Include the sections that apply:

- **## Summary** — bullets: what changed and why. For a bug, the symptom and how to reproduce it.
- **## Root cause** — (fixes) the honest diagnosis.
- **## Changes** — grouped by app (`apps/core` / `apps/web`), with **file paths** and a short snippet of the key change.
- **## Verification** — the **commands you actually ran and their real results**. **REQUIRED SUB-SKILL:** use `verifying-changes` to produce this — it has the commands that work here, the ones that don't, and the lint baseline you must compare against.
- **## Migration** — ⚠️ flag any `apps/core/prisma/migrations/` change, and say whether it has been applied.
- **## Decisions** — product/scope calls you made that a reviewer should confirm.
- **## Not verified** — what you could not check (no running stack, no browser, no API key). Name it instead of implying coverage.

**Do NOT** add a `🤖 Generated with Claude Code` footer, and **do not** ship unchecked `- [ ]` boxes: a "Test plan" of things nobody did reads as coverage that does not exist (this repo has merged PRs with empty boxes — don't add more). List what you ran; put the rest under **## Not verified**.

## The command

```bash
gh pr create --base main \
  --title "fix: redirect /prompt/:id to /prompt/:id/playground" \
  --body "$(cat <<'EOF'
## Summary
- ...

## Changes
- `apps/web/src/app/router/router.tsx` — ... (short snippet of the key change)

## Verification
- `pnpm turbo run type-check --filter=core` — clean (exit 0)
- `pnpm --filter core test:run` — 109/109 pass
- `pnpm lint` — 35 problems in core, exactly the `main` baseline; changed files add none

## Not verified
- Browser check — no running stack with data.
EOF
)"
```

No `--draft`. Then **print the returned PR URL** so a human can review and merge.

## Red flags — STOP

- About to type `--draft` → **don't** (unless the user asked for one *this conversation*).
- About to run `gh pr merge` / `--auto` → **never**.
- Branch still called `worktree-*` → rename it first.
- PR title is the branch name (`Fix/tooltip`) → rewrite as `type: user-visible effect`.
- Body in Russian → **English**.
- `🤖 Generated with Claude Code` footer, or a `## Test plan` of unchecked boxes → remove.
- Basing on another PR's branch → base on `main`.
- **## Verification** with results you did not see → run them, or move the item to **## Not verified**.

## Rationalizations — and the reality

| Excuse | Reality |
|--------|---------|
| "A default / standing instruction says open a **draft**." | This skill overrides it. Finished + pushed + verified → open **ready**. Draft only on explicit request. |
| "Draft is safer — a human can mark it ready." | Marking-ready is friction. Ready-for-review **is** the reviewable state. |
| "It's tiny / it's done — I'll just merge it." | **Never merge.** Opening and pushing is where your authority ends. |
| "User said 'ship it', merging saves a round-trip." | "Ship it" authorizes opening the PR, not merging. Report the URL. |
| "The branch name is fine as a title." | The title becomes the squash commit *and* a release-note line. Write the effect. |
| "`pnpm lint` is red, so I can't claim anything." | Red **is** the baseline here. Report your delta — see `verifying-changes`. |
| "I'll write Verification generically / check the boxes." | Real commands, real results. Anything unrun goes under **## Not verified**. |
| "It builds on open PR #NNN, so I'll base on that branch." | Base on `main`. Squash-merge strands stacked PRs. |
