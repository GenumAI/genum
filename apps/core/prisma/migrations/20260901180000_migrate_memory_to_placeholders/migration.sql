-- One placeholder named memory_key per prompt that owned memories.
INSERT INTO "Placeholder" ("key", "promptId", "createdAt", "updatedAt")
SELECT DISTINCT 'memory_key', m."promptId", NOW(), NOW()
FROM "Memory" m;

-- Every memory becomes one of its values. No value is marked default: today, not
-- passing memoryKey appends nothing, and a placeholder with no default renders
-- exactly that. A synthetic "none" value would pollute the selector and every log line.
INSERT INTO "PlaceholderValue" ("placeholderId", "name", "content", "isDefault", "createdAt", "updatedAt")
SELECT p."id", m."key", m."value", FALSE, NOW(), NOW()
FROM "Memory" m
JOIN "Placeholder" p ON p."promptId" = m."promptId" AND p."key" = 'memory_key';

-- Testcase selections carry over by name -- but only within the same prompt. The old
-- schema had no FK tying TestCase.memoryId to TestCase.promptId, and the update path
-- went unguarded for a time, so a legacy row can point at another prompt's memory. That
-- combination is not representable in the new schema (TestCasePlaceholderValue has no
-- direct link to the testcase's prompt, so nothing downstream would ever catch it), so
-- it is dropped here rather than carried forward.
INSERT INTO "TestCasePlaceholderValue" ("testCaseId", "placeholderId", "placeholderValueId")
SELECT t."id", pv."placeholderId", pv."id"
FROM "TestCase" t
JOIN "Memory" m ON m."id" = t."memoryId" AND m."promptId" = t."promptId"
JOIN "Placeholder" p ON p."promptId" = m."promptId" AND p."key" = 'memory_key'
JOIN "PlaceholderValue" pv ON pv."placeholderId" = p."id" AND pv."name" = m."key"
WHERE t."memoryId" IS NOT NULL;

-- Substitution is positional, so a prompt whose text has no {{memory_key}} would lose
-- its block. Prompt.value is the working DRAFT, not history: appending the marker here
-- restores exactly the old behaviour (memory was appended at the end anyway) and puts
-- it in front of the author, who can move or delete it. Committed versions are NOT
-- touched — that would be forging history — so production stays on the old commit
-- until the author decides to commit. See the report script for who that is.
UPDATE "Prompt"
SET "value" = "value" || E'\n\n{{memory_key}}'
WHERE "id" IN (SELECT DISTINCT "promptId" FROM "Memory")
  AND "value" NOT LIKE '%{{memory_key}}%';

ALTER TABLE "TestCase" DROP COLUMN "memoryId";
DROP TABLE "Memory";
