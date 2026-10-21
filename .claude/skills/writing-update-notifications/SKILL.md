---
name: writing-update-notifications
description: Use when writing, drafting or publishing a Genum product update / "what's new" post for users (the in-app notification and the community.genum.ai forum post) about new features, new models or a release, when a genum release has just been published and the user wants it announced, or when asked to send a post to ARTICLE_URL or the n8n articles-crosspost webhook, in any language.
---

# Writing update notifications (genum)

## Overview

One post is one Markdown file: **the file name is the title, the file body is the content.** `send.sh` uploads it to `$ARTICLE_URL`, the n8n `articles-crosspost` webhook, which publishes it **at once** to the community forum (Discourse), the prod in-app notifications and dev. There is no approval step, no dev-only path and no undo on the n8n side.

**Iron rule: nothing is sent until the user has seen the final file in your reply and answered with an explicit yes to that version.**

## Workflow

1. **Collect what shipped.** Use the user's list, or what changed since the last post: `gh release list`, `gh release view <tag>`, `git log --no-merges --oneline <since>..`. Right after a release, the source is that release's notes, plus any earlier release that was never announced. The newest `createdAt` in `published-posts.json` is the last post this skill knows about. Keep only changes a user can see or use.
2. **Check every claim in the code** (model registry, specs, migrations, UI labels). If the brief and the code disagree, write what the code does and tell the user. No prices, no dates and no specs the code doesn't confirm.
3. **Write** `tmp/notifications/<Title>.md` under the repo root (`tmp/` is gitignored), following the template and style contract below.
4. **Show it and ask.** Your reply contains the path, the full file verbatim in a fenced block, the commit or PR behind each row, and one question in the user's language asking whether they like the text and whether to send it («Нравится текст? Отправляем?» / "Do you like the text? Send it?"). Then stop.
5. **Send only after an explicit yes** to that exact version: `bash .claude/skills/writing-update-notifications/send.sh "tmp/notifications/<Title>.md"`. If anything changed after the yes, go back to step 4.
6. **Report** `discourse_url`, `genum_id_prod` and `genum_id_dev` from the response. `send.sh` exits 0 only when the flow answers `"ok": true`. Exit 3 (`NOT CONFIRMED`) covers an HTTP error and also a 200 with an empty body, which means the run stopped part-way. In either case, show the output and ask the user to check the run in n8n Executions. **Never retry on your own:** some targets may already have published. A 403 `Authorization data is wrong!` is the exception: it is rejected before the flow starts, so nothing was published.

## The file

`tmp/notifications/Roles and LLM Whitelist.md`, with the content starting on line 1:

```markdown
Hi everyone 👋

We’re excited to share another important update from the Genum team — focused on governance and team collaboration.


| Update | Description |
|--------|-------------|
| **Roles & Workspaces** | We’ve introduced flexible roles and structured workspaces. Configure access permissions, organize teams, and collaborate securely in larger environments with fine-grained control. [Learn more](https://docs.genum.ai/teamwork) |
| **Model Whitelist** | You can now define which LLM models are allowed in your workspace. All projects use only approved models — including custom LLM providers. [Learn more](https://docs.genum.ai/llm-providers) |

## 🔐 Why This Matters

Genum continues evolving into an enterprise-ready PromptOps platform:

- Centralized model governance
- Secure team collaboration
- Better compliance and cost management

## 💬 What’s Next

More improvements in access control, scalability, and enterprise capabilities are on the way.

Thanks for building with us ❤️

Let’s keep pushing practical, production-ready AI forward.

**The Genum Team**
```

The real posts are in `published-posts.json`. The newest one is the reference; the 2025 "September Update" uses an older layout, so don't copy it.

## Style contract

| Part | What it is |
|---|---|
| Title (file name) | 2–5 words naming the headline features: `Roles and LLM Whitelist`, `Files, OCR and new LLMs`. A noun phrase, not a sentence. No emoji, no final period, and none of `/ \ : "`. |
| Greeting | `Hi everyone 👋` |
| Intro | One sentence: `We’re excited to share {another / a} {major / important} update from the Genum team`, optionally followed by ` — focused on <theme>.` or ` — this one is big.` |
| Table | Two blank lines before it, the exact header `\| Update \| Description \|`, and one row per distinct shipped feature. Past posts have 2–4 rows. One feature means one row, and its details go in that row's description. Related changes share a row: all new models go in one **New Models Available** row. |
| Row | `\| **Feature Name** \| ... \|`, where the description is 1–3 sentences: what's new (`We’ve added…`, `You can now…`, `Genum now supports…`) followed by the benefit. Model names are bold. At most one 🎉 in the whole post, on the headline feature. |
| Learn more | End a row with ` [Learn more](https://docs.genum.ai/<page>)` only when the page is listed in `https://docs.genum.ai/sitemap.xml` **and** its text covers that feature (`curl -sL https://docs.genum.ai/<page> \| grep -i <feature>`). The site returns 200 for any path, so a status check proves nothing. If no page covers the feature, leave the link out. |
| Optional section | Only when two or more rows share one theme (governance, cost): `## <emoji> Why This Matters`, a lead line ending in `:`, then 3–5 bullets that are short noun phrases. A one-row post goes straight from the table to What's Next. |
| What's Next | `## 💬 What’s Next`, then 1–2 short sentences on direction. Name specific features only if the user did. |
| Closing | The last three paragraphs of the template, verbatim. |
| Typography | Curly `’` (We’re, What’s, Let’s, we’ve), spaced ` — `, `Genum` (not GENUM), English, roughly 120–220 words. |

## Red flags: stop before running send.sh

- The full final file isn't in your last message to the user.
- The user's latest reply isn't a yes to that version ("looks good, but change X" is a change, not a yes).
- You edited the file after the yes, even a single character.

| Thought | Reality |
|---|---|
| "They're in a hurry and said just get it out" | Sending publishes to the forum and prod instantly, with no undo. Show the file; a hurry is not approval. |
| "They approved the earlier draft" | Approval covers the exact text shown. Show the new version. |
| "The send failed, I'll retry" | Part of it may have published already. A retry makes duplicate forum posts and notifications. Ask. |

## Common mistakes

| Mistake | Fix |
|---|---|
| A `# Title` first line or YAML front matter | Line 1 is `Hi everyone 👋`. The title lives only in the file name, and n8n would turn a leading H1 into the title. |
| `2026-10-21-whats-new.md`, a slug or a dated name | The file name is the title, spaces and all. |
| A changelog with sections per feature, deadlines or spec lists | Table rows with one benefit each. Detail belongs in the docs behind `Learn more`. |
| Missing intro, What's Next or closing; an invented section | Every part of the template, in order. The only optional part is "Why This Matters". |
| Drafts in a tracked folder (`update-posts/`) | `tmp/notifications/`. |
| A second row split off one feature to fill the table | One feature, one row. |
| `Learn more` to a page that doesn't mention the feature | Grep the page text first. No matching page means no link. |
