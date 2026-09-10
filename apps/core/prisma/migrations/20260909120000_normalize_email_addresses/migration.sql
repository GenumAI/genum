-- Email addresses are now normalized at every API boundary (`normalizeEmail` in
-- src/utils/email.ts): trimmed, NFC-composed, lowercased, NFC-composed again. Rows
-- written before that change are still stored as typed, so the login path -- which
-- normalizes its input and then looks the address up with `=` -- would stop finding
-- them. This migration folds the existing rows into the same form.
--
-- The SQL mirrors the TypeScript step for step, including the second NFC pass: `lower()`
-- can decompose (U+0130 becomes `i` + U+0307), and without it the database and the
-- application would disagree about the canonical spelling of exactly the addresses this
-- whole change exists to support.

CREATE OR REPLACE FUNCTION pg_temp.normalize_email(addr text) RETURNS text AS $$
    SELECT normalize(lower(normalize(btrim(addr), NFC)), NFC);
$$ LANGUAGE sql IMMUTABLE;

-- 'SYSTEM_USER' is a sentinel, not an address. `ensureSystemUserExists` still looks it up
-- by that literal to migrate v1.3.0 instances, and lowercasing it would strand those
-- installs with a second, duplicate admin. It is excluded everywhere below.

-- Two rows that differ only in case or in how an umlaut was encoded collapse into one
-- value here, and `User.email` is unique. Merging them means deciding which account's
-- prompts, keys and memberships survive -- that is an operator's judgement call about two
-- real people, not something a migration may guess. So abort with the addresses named,
-- and let the operator resolve them before upgrading.
DO $$
DECLARE
    conflicts text;
BEGIN
    SELECT string_agg(normalized, ', ')
    INTO conflicts
    FROM (
        SELECT pg_temp.normalize_email("email") AS normalized
        FROM "User"
        WHERE "email" <> 'SYSTEM_USER'
        GROUP BY 1
        HAVING count(*) > 1
    ) duplicates;

    IF conflicts IS NOT NULL THEN
        RAISE EXCEPTION
            'Cannot normalize email addresses: these normalize to the same value and User.email is unique: %. Merge or delete the duplicate accounts, then re-run the migration.',
            conflicts;
    END IF;
END $$;

UPDATE "User"
SET "email" = pg_temp.normalize_email("email")
WHERE "email" <> 'SYSTEM_USER'
  AND "email" <> pg_temp.normalize_email("email");

-- Invitations are unique per (email, organizationId) and expire in seven days, so a
-- collision here is not an identity to preserve -- it is the same person invited twice to
-- the same organization. Keep the newest row (the one whose token was mailed last) and
-- drop the rest, then normalize what remains.
DELETE FROM "OrganizationInvitation" a
USING "OrganizationInvitation" b
WHERE a."organizationId" = b."organizationId"
  AND pg_temp.normalize_email(a."email") = pg_temp.normalize_email(b."email")
  AND a."id" < b."id";

UPDATE "OrganizationInvitation"
SET "email" = pg_temp.normalize_email("email")
WHERE "email" <> pg_temp.normalize_email("email");
