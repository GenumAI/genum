import { useRef, useState, useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Loader2, Plus } from "lucide-react";
import clsx from "clsx";
import TextEditor from "@/pages/prompt/playground-tabs/playground/components/prompt-editor/TextEditor";
import OutputBlock from "@/pages/prompt/playground-tabs/playground/components/outputs/Output";
import { Button } from "@/components/ui/button";
import SettingsBar from "./components/settings-block/models-settings/SettingsBar";
import { TestcaseAssertionModal } from "@/components/dialogs/TestcaseAssertionDialog";
import AuditResultsModal from "@/components/dialogs/AuditResultsDialog";
import PromptDiff from "@/components/dialogs/PromptDiffDialog";
import { InputTextArea } from "@/pages/prompt/playground-tabs/playground/components/input-textarea/InputTextArea";
import { useSidebar } from "@/components/sidebar/sidebar";
import { usePlaygroundController } from "@/pages/prompt/playground-tabs/playground/hooks/usePlayground";
import { getOrgId, getProjectId } from "@/api/client";
import FileSelectDialog from "@/components/dialogs/FileSelectDialog";
import SelectedFilesList from "@/components/SelectedFilesList";
import type { FileMetadata } from "@/api/files";
import { testcasesApi } from "@/api/testcases/testcases.api";
import { useQueryClient } from "@tanstack/react-query";

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
	const [isFileDialogOpen, setIsFileDialogOpen] = useState(false);
	const [isTestcaseLoading, setIsTestcaseLoading] = useState(false);
	const queryClient = useQueryClient();
	const controller = usePlaygroundController({
		promptId,
		orgId,
		projectId,
		testcaseId,
		selectedFiles,
	});

	const { prompt, testcase, metrics, ui, models, actions } = controller;

	const sidebar = useSidebar();

	// Load testcase files when testcase is opened
	useEffect(() => {
		if (testcase.data?.files && testcase.data.files.length > 0) {
			const testcaseFiles: FileMetadata[] = testcase.data.files.map((tf) => ({
				id: tf.file.id,
				key: tf.file.key,
				name: tf.file.name,
				size: tf.file.size,
				contentType: tf.file.contentType,
				projectId: tf.file.projectId,
				organizationId: 0, // Will be filled from project
				uploadedBy: 0,
				createdAt: tf.file.createdAt,
			}));
			setSelectedFiles(testcaseFiles);
		} else if (!testcaseId) {
			// Clear files when not in testcase mode
			setSelectedFiles([]);
		}
	}, [testcase.data?.files, testcaseId]);

	const handleFileSelect = async (files: FileMetadata[]) => {
		setSelectedFiles(files);

		// If we're in testcase mode, save files to testcase
		if (testcaseId) {
			try {
				// Get current testcase files
				const currentFileIds = testcase.data?.files?.map((tf) => tf.fileId) || [];
				const newFileIds = files.map((f) => f.id);

				// Find files to add and remove
				const filesToAdd = newFileIds.filter((id) => !currentFileIds.includes(id));
				const filesToRemove = currentFileIds.filter((id) => !newFileIds.includes(id));

				// Add new files
				for (const fileId of filesToAdd) {
					await testcasesApi.addFileToTestcase(testcaseId, fileId);
				}

				// Remove files
				for (const fileId of filesToRemove) {
					await testcasesApi.removeFileFromTestcase(testcaseId, fileId);
				}

				// Refresh testcase data
				if (promptId && testcaseId) {
					await queryClient.invalidateQueries({
						queryKey: ["prompt-testcases", promptId],
					});
					await queryClient.invalidateQueries({ queryKey: ["testcase", testcaseId] });
				}
			} catch (error) {
				console.error("Failed to update testcase files:", error);
			}
		}
	};

	const handleFileRemove = async (fileId: string) => {
		const newFiles = selectedFiles.filter((f) => f.id !== fileId);
		setSelectedFiles(newFiles);

		// If we're in testcase mode, remove file from testcase
		if (testcaseId) {
			try {
				await testcasesApi.removeFileFromTestcase(testcaseId, fileId);
				// Refresh testcase data
				if (promptId) {
					await queryClient.invalidateQueries({
						queryKey: ["prompt-testcases", promptId],
					});
					await queryClient.invalidateQueries({ queryKey: ["testcase", testcaseId] });
				}
			} catch (error) {
				console.error("Failed to remove file from testcase:", error);
			}
		}
	};

	return (
		<div className="h-full flex flex-grow-0 max-w-[1470px] ml-3 mr-3 lg:mr-6 w-full text-foreground">
			<div className="flex flex-col lg:flex-row w-full h-full items-start">
				<div className="flex w-full flex-col bg-card text-card-foreground border border-border rounded-[12px] mt-0 pt-3 pb-4 px-4 gap-8">
					{testcaseId && !testcase.data && testcase.loading ? (
						<div className="flex items-center justify-center h-full">
							<Loader2 className="animate-spin" />
							<span className="ml-2">Loading testcase...</span>
						</div>
					) : (
						<>
							<TextEditor
								title="System Instructions"
								main={true}
								onUpdatePrompt={actions.prompt.update}
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
								/>

								<div className="flex items-center justify-between gap-2 mt-3">
									<div className="flex items-center gap-2 flex-1 min-w-0">
										<Button
											variant="ghost"
											size="sm"
											onClick={() => setIsFileDialogOpen(true)}
											disabled={selectedFiles.length >= 3}
											className="text-[12px] h-[28px] px-2 bg-muted/50 hover:bg-muted/70 flex-shrink-0"
										>
											<Plus className="h-3 w-3 mr-1.5" />
											Add files
										</Button>
										<SelectedFilesList
											files={selectedFiles}
											onRemove={handleFileRemove}
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
										className="text-[14px] h-[32px] w-[138px] flex-shrink-0"
									>
										{ui.loading.run && <Loader2 className="animate-spin" />}
										{testcaseId ? "Run testcase" : "Run prompt"}
									</Button>
								</div>
							</div>

							<OutputBlock
								key={testcaseId}
								onSaveAsExpected={actions.testcase.saveAsExpected}
								onTestcaseAdded={actions.testcase.onAdded}
								onRegisterClearFunction={actions.testcase.registerClearFn}
								selectedFiles={selectedFiles}
								onTestcaseLoadingChange={setIsTestcaseLoading}
							/>
						</>
					)}
				</div>

				<div
					className={clsx(
						"w-full transition-all md:w-[322px] md:min-w-[322px] 2xl-plus:w-[400px] 2xl-plus:min-w-[400px] lg:pt-0 lg:pl-6",
						{ "xl:min-w-[400px]": !sidebar.open },
					)}
				>
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
				auditData={ui.modals.audit.data || prompt.data?.prompt?.audit?.data || null}
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

			<FileSelectDialog
				open={isFileDialogOpen}
				setOpen={setIsFileDialogOpen}
				selectedFiles={selectedFiles}
				onSelect={handleFileSelect}
				maxFiles={3}
			/>
		</div>
	);
}
