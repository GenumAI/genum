import { useParams } from "react-router-dom";
import CanvasChatUI from "./CanvasChatUI";
import AuditResultsModal from "@/components/dialogs/AuditResultsDialog";
import PromptDiff from "@/components/dialogs/PromptDiffDialog";
import type { CanvasChatProps } from "./types";
import { useCanvasChat } from "./hooks/useCanvasChat";
import { ChatHeader, ChatModalDialog } from "./components";

const CanvasChat = ({ systemPrompt, updatePromptContent }: CanvasChatProps) => {
	const { id } = useParams<{ id: string }>();
	const promptId = id ? Number(id) : undefined;

	const controller = useCanvasChat({ promptId, systemPrompt, updatePromptContent });
	const { messages, ui, actions, audit, diff, messagesRef } = controller;

	return (
		<>
			<ChatHeader
				isOpen={ui.isOpen}
				messagesCount={messages.data.length}
				onToggle={actions.toggleOpen}
				onNewChat={actions.createNewChat}
				onExpand={() => actions.setIsModalMode(true)}
			/>

			{ui.isOpen && (
				<div className="h-full flex flex-col">
					<CanvasChatUI
						messagesRef={messagesRef}
						isOpen={ui.isOpen}
						messages={messages.data}
						isLoading={messages.loading}
						message={ui.message}
						setMessage={actions.setMessage}
						handleKeyPress={actions.handleKeyPress}
						mode={ui.mode}
						setMode={actions.setMode}
						isRecording={ui.isRecording}
						setIsRecording={actions.setIsRecording}
						sendMessage={actions.sendMessage}
						sendMessageWithText={actions.sendMessageWithText}
					/>
				</div>
			)}

			<ChatModalDialog
				isOpen={ui.isModalMode}
				onOpenChange={actions.setIsModalMode}
				messagesCount={messages.data.length}
				onNewChat={actions.createNewChat}
			>
				<CanvasChatUI
					isOpen={true}
					messages={messages.data}
					isLoading={messages.loading}
					messagesRef={messagesRef}
					message={ui.message}
					setMessage={actions.setMessage}
					handleKeyPress={actions.handleKeyPress}
					mode={ui.mode}
					setMode={actions.setMode}
					isRecording={ui.isRecording}
					setIsRecording={actions.setIsRecording}
					sendMessage={actions.sendMessage}
					sendMessageWithText={actions.sendMessageWithText}
				/>
			</ChatModalDialog>

			<PromptDiff
				isOpen={!!diff.modalInfo}
				onOpenChange={diff.onClose}
				original={systemPrompt}
				modified={diff.modalInfo?.prompt ?? ""}
				onChange={diff.onChange}
				onSave={diff.onSave}
			/>

			{promptId !== undefined && (
				<AuditResultsModal
					auditData={audit.currentData}
					isLoading={audit.isLoading}
					isFixing={audit.isFixing}
					isOpen={audit.showModal}
					onClose={audit.onClose}
					onRunAudit={audit.onRun}
					onFixRisks={audit.onFix}
					isDisabledFix={false}
				/>
			)}
		</>
	);
};

export default CanvasChat;
