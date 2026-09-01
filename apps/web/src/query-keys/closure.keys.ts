export const closureKeys = {
	all: ["closure"] as const,
	preview: () => [...closureKeys.all, "preview"] as const,
};
