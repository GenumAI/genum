/**
 * Common types for settings pages
 */

import type { ProjectMember, Project, ProjectRole } from "@/api/project";
import type {
	Member,
	Invite,
	CustomProviderDeleteStatus,
	LanguageModel,
	CustomProvider,
	OrganizationRole,
} from "@/api/organization/organization.api";
import type { Organization } from "@/api/organization";
import type { OrganizationFormValues } from "../hooks/useOrganization";
import type { ProjectFormValues } from "../hooks/useProject";

// ============================================================================
// Enums & Base Types
// ============================================================================

export type Vendor = "OPENAI" | "GOOGLE" | "ANTHROPIC";

export enum SettingsTab {
	PROVIDERS = "providers",
	CUSTOM = "custom",
}

export type SortDirection = "asc" | "desc";

/** Project with relation counts (e.g. from org projects list) */
export interface ProjectWithCount extends Project {
	_count: { members: number; Prompts: number };
}

// ============================================================================
// API Keys Types
// ============================================================================

export interface AIKey {
	id: number;
	vendor: string;
	createdAt: string;
	publicKey: string;
}

export interface OrgKey {
	id: number;
	name: string;
	publicKey: string;
	createdAt: string;
	lastUsed?: string;
	project: {
		id: number;
		name: string;
	};
	author: {
		id: number;
		name: string;
		email: string;
		picture?: string;
		avatar?: string;
	};
}

export interface NewKeyResponse {
	key: string;
}

// ============================================================================
// User Types
// ============================================================================

export interface User {
	id: number;
	email: string;
	name: string;
	picture?: string;
}

// ============================================================================
// Sort Types
// ============================================================================

export type APIKeySortColumn =
	| "projectName"
	| "name"
	| "publicKey"
	| "author"
	| "createdAt"
	| "lastUsed";

export type ProjectAPIKeySortColumn = "name" | "publicKey" | "author" | "createdAt" | "lastUsed";

export interface UseSortOptions<T extends string, D> {
	data: D[];
	sortFn: (a: D, b: D, column: T) => number;
}

export interface UseSortReturn<T extends string, D> {
	sortColumn: T | null;
	sortDirection: SortDirection;
	handleSort: (column: T) => void;
	sortedData: D[];
}

// ============================================================================
// Hook Return Types
// ============================================================================

export interface UseCustomProviderReturn {
	customModels: any[];
	isLoading: boolean;
	createModel: (data: any) => Promise<void>;
	updateModel: (id: number, data: any) => Promise<void>;
	deleteModel: (id: number) => Promise<void>;
	refresh: () => Promise<void>;
}

export interface UseOrgAPIKeysReturn {
	keys: OrgKey[];
	isLoading: boolean;
	isDeleting: boolean;
	deleteKey: (key: OrgKey) => Promise<void>;
}

export interface UseAIKeysReturn {
	aiKeys: AIKey[];
	isLoading: boolean;
	createKey: (vendor: string) => Promise<void>;
	deleteKey: (id: number) => Promise<void>;
	refresh: () => Promise<void>;
}

export interface CreateProjectValues {
	name: string;
	description: string;
}

// ============================================================================
// Component Props Types
// ============================================================================

// Dialog Props
export interface EditProfileDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	currentName: string;
	onSave: (name: string) => Promise<boolean>;
	isUpdating: boolean;
}

export interface SendFeedbackDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSubmit: (type: string, subject: string, message: string) => Promise<boolean>;
	isSubmitting: boolean;
}

export interface CreateProjectDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onCreate: (values: ProjectFormValues) => Promise<boolean>;
	isCreating: boolean;
}

export interface AddAIKeyDialogProps {
	onAdd: (key: string, vendor: Vendor) => Promise<void>;
}

export interface ModelConfigDialogProps {
	model: LanguageModel;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSaved: () => void;
}

export interface DeleteProviderDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onConfirm: () => Promise<void>;
	deleteStatus: CustomProviderDeleteStatus | null;
	deleteStatusError: string | null;
	isCheckingDeleteStatus: boolean;
	isDeletingProvider: boolean;
	buildPromptHref: (promptId: number) => string;
}

export interface CustomModelDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	customProvider: any | null;
	onSaved: () => void | Promise<void>;
}

export interface EditOrgDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	organization: Organization;
	onSuccess: (values: OrganizationFormValues) => Promise<boolean>;
}

export interface EditProjectDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	project: Project;
	onSuccess: (values: ProjectFormValues) => Promise<boolean>;
}

export interface DeleteConfirmDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onConfirm: () => void | Promise<void>;
	title: string;
	description: React.ReactNode;
	isDeleting?: boolean;
	confirmText?: string;
	cancelText?: string;
}

export interface InviteMemberDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onInvite: (email: string, role: OrganizationRole) => Promise<{ success: boolean; inviteUrl?: string }>;
	isInviting: boolean;
}

export interface AddMemberDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onAdd: (userId: number, role: ProjectRole) => Promise<boolean>;
	availableUsers: User[];
	hasEndpoint: boolean;
	isAdding: boolean;
}

export interface CreateAPIKeyDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onCreate: (name: string) => Promise<boolean>;
	isCreating: boolean;
	newKeyResponse: NewKeyResponse | null;
	onDone: () => void;
}

// Table Props
export interface ProjectsTableProps {
	projects: ProjectWithCount[];
	isLoading: boolean;
	currentProjectId: number | null;
	deletingId: number | null;
	onDelete: (project: ProjectWithCount) => void;
}

export interface MembersTableProps {
	members: ProjectMember[];
	isLoading: boolean;
	currentUserEmail?: string;
	updatingRoleId?: number | null;
	deletingId: number | null;
	onRoleChange?: (id: number, role: ProjectRole) => void;
	onDelete?: (member: ProjectMember) => void;
}

export interface OrgMembersTableProps {
	members: Member[];
	isLoading: boolean;
	currentUserEmail?: string;
	currentUserRole?: OrganizationRole;
	canManageMembers: boolean;
	updatingRoleId?: number | null;
	deletingId?: number | null;
	onRoleChange?: (memberId: number, role: OrganizationRole) => void;
	onDelete?: (member: Member) => void;
}

export interface InvitesTableProps {
	invites: Invite[];
	isLoading: boolean;
	deletingIds: Set<number>;
	onDelete: (invite: Invite) => void;
}

export interface StandardKeysSectionProps {
	keys: AIKey[];
	isLoading: boolean;
	onAddKey: (key: string, vendor: Vendor) => Promise<void>;
	onDeleteKey: (keyId: number) => Promise<void>;
}

export interface ProviderModelsTableProps {
	providerId: number;
}

export interface CustomProviderSectionProps {
	provider: CustomProvider | null;
	isLoading: boolean;
	isSyncing: boolean;
	deleteStatus: CustomProviderDeleteStatus | null;
	deleteStatusError: string | null;
	isCheckingDeleteStatus: boolean;
	onSync: () => Promise<void>;
	onDelete: () => Promise<void>;
	onCheckDeleteStatus: () => Promise<void>;
	onProviderSaved: () => Promise<void>;
}

export interface QuotaCardProps {
	quota: number | null;
	isLoading: boolean;
}

export interface APIKeyTableRowProps {
	keyData: {
		id: string | number;
		name: string;
		publicKey: string;
		createdAt: string;
		lastUsed?: string;
		project?: {
			id: number;
			name: string;
		};
		author: {
			id: number;
			name: string;
			email: string;
			picture?: string;
			avatar?: string;
		};
	};
	onDelete: () => void;
	showProject?: boolean;
	isDeleting?: boolean;
}
