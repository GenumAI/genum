import { useParams, useSearchParams } from "react-router-dom";
import { useMemo } from "react";
import { getOrgId, getProjectId } from "@/api/client";

export function usePlaygroundParams() {
	const { id } = useParams<{ id: string }>();
	const orgId = getOrgId();
	const projectId = getProjectId();

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

