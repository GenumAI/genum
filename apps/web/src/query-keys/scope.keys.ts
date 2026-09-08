import { getOrgId, getProjectId } from "@/api/client";

/**
 * Workspace-scoped endpoints take their organization and project from the `lab-org-id` /
 * `lab-proj-id` request headers the axios interceptor attaches, never from the path, so
 * two workspaces fetch the very same URL. A key naming only the entity would therefore be
 * one cache entry shared by both, and switching workspace serves the previous one's rows
 * until something refetches -- which `useOrgModels` (`refetchOnMount: false`) never does.
 * Reading the same module state the interceptor reads keeps the workspace in the key
 * without any call site having to pass it.
 */
export const orgScope = () => [getOrgId()] as const;

export const workspaceScope = () => [getOrgId(), getProjectId()] as const;
