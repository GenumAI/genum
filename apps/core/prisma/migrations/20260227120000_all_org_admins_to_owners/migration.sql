-- Migrate all organization members with role ADMIN to OWNER
UPDATE "OrganizationMember"
SET role = 'OWNER'
WHERE role = 'ADMIN';
