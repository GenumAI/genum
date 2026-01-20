import { ChevronLeft } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { useState, useCallback } from "react";

import { Button } from "@/components/ui/button";
import AuditResultsModal from "@/components/dialogs/AuditResultsDialog";

import { RollBackButton } from "./RollbackButton";
import { VersionHeader } from "./VersionHeader";
import { ModelConfigCard } from "./ModelConfigCard";
import { VersionJsonViewer } from "./VersionJsonViewer";
import { AuditSection } from "./AuditSection";
import { VersionPromptContent } from "./VersionPromptContent";

import { useVersionDetails } from "../hooks/useVersionDetails";

export default function VersionDetails() {
	const navigate = useNavigate();
	const { id, versionId } = useParams<{ id: string; versionId: string }>();
	const [showAuditModal, setShowAuditModal] = useState(false);

	const {
		data,
		isLoading,
		parsedSchema,
		parsedTools,
		auditData,
		modelConfigParams,
	} = useVersionDetails(id, versionId);

	const backHandler = () => {
		navigate(-1);
	};

	const handleOpenAuditModal = useCallback(() => {
		setShowAuditModal(true);
	}, []);

	const handleCloseAuditModal = useCallback(() => {
		setShowAuditModal(false);
	}, []);

	if (isLoading) {
		return <div className="p-8">Loading...</div>;
	}

	return (
		<div className="px-8 py-10 space-y-6 w-full max-w-[936px] min-h-screen bg-background text-foreground">
			<div className="flex items-center justify-between">
				<Button variant="outline" className="flex items-center text-sm" onClick={backHandler}>
					<ChevronLeft className="h-4 w-4" />
					<span>Back</span>
				</Button>
				<RollBackButton />
			</div>

			{data && (
				<>
					<div className="flex flex-col gap-12 text-card-foreground">
						<VersionHeader
							commitMsg={data.version.commitMsg}
							commitHash={data.version.commitHash}
							createdAt={data.version.createdAt}
							authorName={data.version.author?.name}
						/>

						<ModelConfigCard
							vendor={data.version.languageModel?.vendor}
							name={data.version.languageModel?.name}
							params={modelConfigParams}
						/>

						<VersionJsonViewer title="output_schema" data={parsedSchema} />

						<VersionJsonViewer title="tools" data={parsedTools} />

						{auditData && (
							<AuditSection
								auditData={auditData}
								onOpenDetails={handleOpenAuditModal}
							/>
						)}

						<VersionPromptContent content={data.version.value} />
					</div>

					{auditData && (
						<AuditResultsModal
							auditData={auditData}
							isOpen={showAuditModal}
							onClose={handleCloseAuditModal}
							isLoading={false}
							isFixing={false}
							isDisabledFix={true}
							onRunAudit={() => {}}
							onFixRisks={() => {}}
						/>
					)}
				</>
			)}
		</div>
	);
}
