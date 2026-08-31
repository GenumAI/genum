# Closing a Genum account

How a user account is closed, why it is tombstoned rather than deleted, and what
a closure deliberately leaves standing.

Code: [`apps/core/src/erasure/`](../apps/core/src/erasure/),
[`ErasureRepository`](../apps/core/src/database/repositories/ErasureRepository.ts),
[`ErasureService`](../apps/core/src/services/erasure.service.ts).

## The rule

**A closed account's `User` row is tombstoned. It is never deleted.**

Seven of the eight relations pointing at `User` are `onDelete: Cascade`. A
`user.delete` would take the person's project memberships, their prompt chats and
their project API keys with them — and `PromptVersion.author` is the eighth, an
`onDelete: SetNull`, so the commit history of prompts that belong to the
*organization* would lose its authorship in the same statement.

Deleting the row also orphans the personal organization. Every self-hosted and
cloud account is created with one (`createPersonalOrganization`), it holds their
projects and prompts, and they are its only OWNER. Cascade the membership away
and the organization is left with no members at all: nobody can open it, nobody
can administer it, and nobody can delete it. The prompts inside it are still
addressed by id from the mail service integration (see `MailServiceRouter`), so
orphaning them breaks a live integration rather than merely losing data.

The tombstone gets the same result the delete was reaching for — the person is
unidentifiable and cannot get back in — without any of that.

## What the row becomes

| column | after closure | why this shape |
|---|---|---|
| `email` | `erased-<id>@erased.invalid` | `@unique`, so it must differ per row. RFC 2606 reserves `.invalid`, so the address is undeliverable by construction |
| `authID` | `erased-<id>` | NOT NULL, and it must be unique per row — see below |
| `name` | `Deleted user` | NOT NULL, not an identifier, and read by humans |
| `picture` | `null` | the only nullable one of the four |
| `erasedAt` | now | the soft-delete marker; `NULL` for every live account |

Values live in [`tombstone.ts`](../apps/core/src/erasure/tombstone.ts).

### `authID` must be unique per row, and the codebase already proves it

`UsersRepository.getUserByAuthID` is a `findFirst`, because `authID` carries no
unique constraint. It opens with:

```ts
if (authID.trim().length === 0) {
    return null;
}
```

That guard exists because `createLocalUser` writes `authID: ""` for every
self-hosted user, so without it one empty lookup would return an arbitrary local
account. A shared tombstone constant — `"deleted"`, `"erased"` — would recreate
that exact bug one step past the guard: the second erased user's lookup would
return the first one.

Deriving from the primary key makes a wrong match impossible. It also cannot
collide with a real identity: Auth0 subjects are `<connection>|<id>`, and
`erased-42` has no separator.

### Derived, not random

Every replaced value comes from the row's own `id`. The id is already in the row,
so deriving from it leaks nothing new — but it makes the write **idempotent**. A
closure that crashes half way through can be re-run and produces byte-identical
values, and an already-tombstoned row is recognisable as such. With random
values, "already done" and "not yet" are indistinguishable, and the half-finished
closures are exactly the ones that most need finishing.

## What is deleted, and what is kept

Classified in [`user-relations.ts`](../apps/core/src/erasure/user-relations.ts),
one entry per relation on `User`.

**Deleted** — a row earns this by being an authentication path back into the
account, or the person's own activity with no value to the organization:

| relation | model | why |
|---|---|---|
| `userSessions` | `UserSession` | a live session survives the closure; the row also holds `ip` and `userAgent` |
| `userCredentials` | `UserCredential` | the password hash is personal data and the second way back in |
| `promptChats` | `PromptChat` | the person's own messages; `PromptChatMessage` cascades from it; no other member can see them |
| `notificationReads` | `NotificationRead` | a per-user read marker, meaningless once the person is gone |

**Kept**, each with its grounds recorded in the source: organization and project
memberships, `PromptVersion` authorship, and `ProjectApiKey`.

The reason so much can be kept is the tombstone itself. After closure every one
of those rows points at an anonymised record, so a join through them yields
`Deleted user` rather than a person — **retention of a foreign key to an
anonymised row is not retention of personal data.** And the memberships authorize
nobody, because every authentication path above is deleted and `authID` becomes a
value no identity provider can issue.

`ProjectApiKey` is the one worth stating out loud: it authorizes the **project**,
`authorId` is attribution, and other members' integrations run on it. Revoking it
because one person left is a denial of service against the organization. It is
the same line GitHub draws between a personal access token, which dies with the
account, and a deploy key, which does not.

## The three places an address hides from a relation walk

Walking the user's relations does not find any of these, so the repository
handles them by hand, **before** `User.email` is overwritten:

- **`OrganizationInvitation.email`** — keyed `(email, organizationId)` with no
  `userId` column at all. A pending invitation would keep the real address
  forever. Deleted by the pre-tombstone address.
- **`Organization.description`** and **`Project.description`** —
  `createPersonalOrganization` writes `Personal organization for <email>` and
  `Personal project for <email>` at signup. Free text; the address is rewritten
  in place.

Across the whole schema an address appears in exactly two columns: `User.email`
and `OrganizationInvitation.email`. A guard test asserts that and fails the day a
third appears.

Matching is case-insensitive, and the address is escaped before it is used as a
pattern — an unescaped `.` in `a.person@example.com` matches any character, which
would rewrite a *different* person's description.

## Refusals

[`decideLabErasure`](../apps/core/src/erasure/decide-user-erasure.ts) is pure and
refuses two accounts, in a fixed order so the reported reason is stable:

1. **`system_user`** — the instance's own account, by configured
   `systemConfig[SYSTEM_USER_ID]` or by the legacy `SYSTEM_USER` address that
   `ensureSystemUserExists` still migrates on every boot. Closing it breaks the
   bootstrap.
2. **`sole_owner_of_shared_organization`** — the only OWNER of an organization
   other people are still in. Removing them leaves nobody who can invite, change
   roles, or close it. A human transfers ownership first.

The second guard is decided on **member counts, never on `Organization.personal`**.
That flag is `@default(true)`, set once at creation, and nothing keeps it honest
when a personal organization is later shared. Counts are the truth; the flag is a
hint. A "personal" organization that has since gained members still refuses.

An account that is already tombstoned is still erasable — re-running reports
`alreadyErased: true` rather than failing.

## Adding a relation to `User`

`user-relations.test.ts` reads `prisma/models/*.prisma` **as text** and fails
until your new relation appears in exactly one of the two lists:

```
New relation(s) on User: secretDiaries. Closing an account must visit or
deliberately skip every one. Add each to ERASED_USER_RELATIONS (with the model
and its user-id column) or to RETAINED_USER_RELATIONS (with the grounds for
keeping it).
```

Text, never the generated Prisma client: the client lives in `src/.generated`, is
gitignored, and is a build artifact. A stale one describes yesterday's schema and
would pass on precisely the change the test exists to catch.

This is the point of the whole module. The dangerous defect in an erasure is not
a bug in the code that runs — it is a relation added six months from now, in a
feature that has nothing to do with erasure, whose rows then quietly survive
every future closure while every test keeps passing.

## What a closure does not reach

Stated because a closure that overstates itself is worse than one that admits its
edges.

- **Copies already sent to `WEBHOOK_URL`.** `postRegister` ships `{id, email,
  name, created_at, ip, geo}` off-box at signup, `sendFeedback` ships
  `userEmail`, and `orgInviteEmail` ships the invitee's address. Those payloads
  left the database when they were sent and no closure here can recall them.
  Whoever operates that endpoint has to erase its copies separately.
- **The other two systems.** This is the Lab leg only. Under `INSTANCE_TYPE=cloud`
  an account also exists in Auth0, and may exist in the mail product; closing
  those is a separate, ordered operation and is not what this module does.
- **ClickHouse AI run logs** are append-only by design and are keyed by ids, not
  by an address.

## Running one

There is no HTTP endpoint, deliberately: a public prefix carrying an
account-erasure endpoint has to be guarded per route and tested per handler, and
both callers below run in-process.

**`ErasureService` — this system only.**

```ts
const outcome = await erasureService.previewErasure(userId); // writes nothing
const outcome = await erasureService.eraseUser(userId);      // tombstones
```

`previewErasure` counts exactly what `eraseUser` would delete, using the same
classification — a dry run cannot promise more than the run delivers. Both return
`not_found` for an unknown id, so a caller can tell "no such user" from "refused".

**`AccountClosureService` — every system.** Use this one to close an account for
real; `ErasureService` on its own leaves the identity provider untouched.

```ts
const preview = await closureService.previewClosure(userId); // writes nothing
const outcome = await closureService.closeAccount(userId);
```

It runs six steps in a fixed order — our guard, their guard, lock out every
identity, their tombstone, our tombstone, delete the identities — and both guards
run before anything is written. That is what makes it a two-phase commit rather
than a fan-out: without it we lock a person out of their identity provider and
only then discover a leg refuses. Identity deletion is last because it is the
only irreversible step.

Every step is idempotent, so re-running a closure that died part way through is
the intended recovery. A failure reports the step it stopped on plus the steps
that already landed.

Configuration decides reach, and the branch is not cosmetic. On
`INSTANCE_TYPE=local` there is no identity provider and no mail service, so an
unset `MAIL_SERVICE_URL` / `MAIL_ERASURE_APIKEY` means a local-only closure —
refusing there would make every self-hosted account permanently unclosable. On
`INSTANCE_TYPE=cloud` the same unset configuration **refuses**, because the
account also exists at the identity provider and erasing only this side would
tell the person their account is closed while they can still log in.

### Not yet verified

`MailErasureClient`'s wire shapes — the request body naming the user, and the
response readers — were written without the mail service's repository open, and
are gathered in one marked block at the top of that file for exactly that reason.
Reconcile them against its request parser before this ships.
