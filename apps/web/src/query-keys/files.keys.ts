import { workspaceScope } from "./scope.keys";

export const fileKeys = {
	all: () => ["files", ...workspaceScope()] as const,
	upload: () => ["files-upload"] as const,
};
