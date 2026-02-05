import { useEffect, useRef } from "react";
import { useParams } from "react-router-dom";

export function useRefetchOnWorkspaceChange(
	refetchCallback: () => void | Promise<void>,
	options?: { skip?: boolean },
) {
	const { orgId, projectId } = useParams<{ orgId: string; projectId: string }>();
	const prevWorkspaceRef = useRef<{ orgId?: string; projectId?: string }>({
		orgId,
		projectId,
	});
	const isFirstRenderRef = useRef(true);

	useEffect(() => {
		const prev = prevWorkspaceRef.current;

		// Skip on first render if requested
		if (isFirstRenderRef.current) {
			isFirstRenderRef.current = false;
			prevWorkspaceRef.current = { orgId, projectId };
			return;
		}

		// Check if workspace actually changed
		const workspaceChanged = prev.orgId !== orgId || prev.projectId !== projectId;

		// Only refetch if workspace changed and both orgId and projectId are present
		if (workspaceChanged && orgId && projectId && !options?.skip) {
			void refetchCallback();
		}

		// Update the ref for next comparison
		prevWorkspaceRef.current = { orgId, projectId };
	}, [orgId, projectId, refetchCallback, options?.skip]);
}
