import { useParams, useSearchParams } from "react-router-dom";
import { useMemo } from "react";

export function usePlaygroundParams() {
	const { orgId, projectId, id } = useParams<{
		orgId: string;
		projectId: string;
		id: string;
	}>();

	const [searchParams] = useSearchParams();
	const testcaseId = searchParams.get("testcaseId");
	const promptId = useMemo(() => (id ? Number(id) : undefined), [id]);

	return {
		orgId,
		projectId,
		promptId,
		testcaseId,
	};
}

