import { useCallback, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import TextEditor from "@/pages/prompt/playground-tabs/playground/components/prompt-editor/TextEditor";
import OutputBlock from "@/pages/prompt/playground-tabs/playground/components/outputs/Output";
import { Button } from "@/components/ui/button";
import SettingsBar from "./components/settings-block/models-settings/SettingsBar";
import { TestcaseAssertionModal } from "@/components/dialogs/TestcaseAssertionDialog";
import AuditResultsModal from "@/components/dialogs/AuditResultsDialog";
import PromptDiff from "@/components/dialogs/PromptDiffDialog";
import { InputTextArea } from "@/pages/prompt/playground-tabs/playground/components/input-textarea/InputTextArea";
import { PlaygroundMainSkeleton } from "./utils/playgroundSkeletons";
import { usePlaygroundController } from "@/pages/prompt/playground-tabs/playground/hooks/usePlayground";
import { getOrgId, getProjectId } from "@/api/client";
import SelectedFilesList from "@/pages/files/components/SelectedFilesList";
import type { FileMetadata } from "@/api/files";

export default function Playground() {
	const orgId = getOrgId();
	const projectId = getProjectId();
	const { id } = useParams<{ id: string }>();
	const parsedPromptId = id ? Number.parseInt(id, 10) : Number.NaN;
	const promptId = Number.isFinite(parsedPromptId) ? parsedPromptId : undefined;
	const [searchParams] = useSearchParams();
	const testcaseId = searchParams.get("testcaseId");

	const inputRef = useRef<HTMLTextAreaElement>(null);
	const [selectedFiles, setSelectedFiles] = useState<FileMetadata[]>([]);
	const [isTestcaseLoading, setIsTestcaseLoading] = useState(false);
	const [textEditorReadyPromptId, setTextEditorReadyPromptId] = useState<number | undefined>();
	const [settingsBarReadyPromptId, setSettingsBarReadyPromptId] = useState<number | undefined>();
	const controller = usePlaygroundController({
		promptId,
		orgId,
		projectId,
		testcaseId,
		selectedFiles,
	});

	const { prompt, testcase, metrics, ui, models, actions } = controller;
	const isInitialLoading = ui.loading.prompt || testcase.loading;

	return (
		<div className="h-full w-full min-w-0 overflow-x-hidden px-3 pt-8 text-foreground lg:pr-6">
			{isInitialLoading ? (
				<div className="flex w-full min-w-0 flex-col gap-6 lg:flex-row lg:flex-wrap lg:items-start">
					<PlaygroundMainSkeleton />
					<div className="w-full min-w-0 shrink-0 lg:w-[clamp(280px,24vw,400px)] lg:min-w-[280px] lg:max-w-[400px]">
						<SettingsBar
							prompt={prompt.data?.prompt}
							models={models}
							tokens={metrics.tokens}
							cost={metrics.cost}
							responseTime={metrics.responseTime}
							updatePromptContent={actions.prompt.update}
							isUpdatingPromptContent={ui.loading.updatingContent}
						/>
					</div>
				</div>
			) : (
				<div className="flex w-full min-w-0 flex-col gap-6 lg:flex-row lg:flex-wrap lg:items-start">
					<div className="flex w-full min-w-0 flex-col gap-8 overflow-hidden rounded-[12px] border border-border bg-card px-4 pb-4 pt-3 text-card-foreground lg:flex-1">
						<TextEditor
							title="System Instructions"
							main={true}
							content={prompt.content}
							onUpdatePrompt={actions.prompt.update}
							onLivePromptChange={actions.prompt.setLiveValue}
							metrics={metrics}
							testcaseInput={testcase.data?.input}
							expectedContent={testcase.expectedContent}
							onAuditPrompt={actions.audit.run}
							onOpenAuditModal={actions.audit.openModal}
							isAuditLoading={ui.loading.audit}
							canAudit={!!prompt.content}
							auditRate={ui.modals.audit.rate}
						/>

						<div>
							<InputTextArea
								ref={inputRef}
								onBlur={actions.testcase.onInputBlur}
								promptId={promptId}
								systemPrompt={prompt.content}
								hasPromptContent={ui.validation.hasPromptContent}
							/>

							<div className="mt-3 flex w-full min-w-0 flex-wrap items-center justify-between gap-2">
								<div className="w-full min-w-0 sm:flex-1">
									<SelectedFilesList
										selectedFiles={selectedFiles}
										setSelectedFiles={setSelectedFiles}
										testcaseId={testcaseId}
										promptId={promptId}
										testcaseFiles={testcase.data?.files}
										maxFiles={3}
									/>
								</div>
								<Button
									disabled={
										!ui.validation.hasPromptContent ||
										!ui.validation.hasInputContent ||
										ui.loading.run ||
										isTestcaseLoading
									}
									onClick={actions.run}
									className="h-[32px] w-full flex-shrink-0 text-[14px] sm:w-[138px]"
								>
									{ui.loading.run && <Loader2 className="animate-spin" />}
									{testcaseId ? "Run testcase" : "Run prompt"}
								</Button>
							</div>
						</div>

						<OutputBlock
							onSaveAsExpected={actions.testcase.saveAsExpected}
							onTestcaseAdded={actions.testcase.onAdded}
							onRegisterClearFunction={actions.testcase.registerClearFn}
							selectedFiles={selectedFiles}
							onTestcaseLoadingChange={setIsTestcaseLoading}
							isRunning={ui.loading.run}
							serverAssertionType={prompt.data?.prompt?.assertionType}
							serverAssertionValue={prompt.data?.prompt?.assertionValue}
						/>
					</div>
 
					<div className="w-full min-w-0 shrink-0 lg:w-[clamp(280px,24vw,400px)] lg:min-w-[280px] lg:max-w-[400px]">
						<SettingsBar
							prompt={prompt.data?.prompt}
							models={models}
							tokens={metrics.tokens}
							cost={metrics.cost}
							responseTime={metrics.responseTime}
							updatePromptContent={actions.prompt.update}
							isUpdatingPromptContent={ui.loading.updatingContent}
						/>
					</div>
				</div>
			)}

			{shouldShowTransitionSkeleton && (
				<div className="absolute left-3 right-3 top-8 z-10 flex min-w-0 flex-col gap-6 lg:right-6 lg:flex-row lg:flex-wrap lg:items-start">
					<PlaygroundMainSkeleton />
					<div className="w-full min-w-0 shrink-0 lg:w-[clamp(280px,24vw,400px)] lg:min-w-[280px] lg:max-w-[400px]">
						<PlaygroundSettingsSkeleton />
					</div>
				</div>
			)}

			{testcase.data && (
				<TestcaseAssertionModal
					open={ui.modals.assertion.open}
					onClose={actions.ui.closeAssertionModal}
					testcase={testcase.data}
					status={ui.modals.assertion.status}
					assertionType={prompt.data?.prompt?.assertionType || "AI"}
				/>
			)}

			<AuditResultsModal
				auditData={ui.modals.audit.data || null}
				isLoading={ui.loading.audit}
				isFixing={ui.loading.fixing}
				isOpen={ui.modals.audit.open}
				onClose={actions.audit.closeModal}
				onRunAudit={actions.audit.runAudit}
				onFixRisks={actions.audit.fix}
				isDisabledFix={false}
			/>

			{ui.modals.diff && (
				<PromptDiff
					isOpen={!!ui.modals.diff}
					onOpenChange={(open) => !open && actions.ui.setDiffModal(null)}
					original={prompt.originalContent || prompt.content || ""}
					modified={ui.modals.diff.prompt}
					isLoading={false}
					onSave={actions.audit.saveDiff}
				/>
			)}
		</div>
	);
}
