import type { Message } from "@/types/Canvas";

export interface CanvasChatProps {
	systemPrompt: string;
	updatePromptContent: (value: string) => void;
}

export interface ChatUIState {
	isOpen: boolean;
	isModalMode: boolean;
	message: string;
	mode: string;
	isRecording: boolean;
}

export interface ChatUIActions {
	setIsOpen: (value: boolean) => void;
	setIsModalMode: (value: boolean) => void;
	setMessage: React.Dispatch<React.SetStateAction<string>>;
	setMode: (value: string) => void;
	setIsRecording: (value: boolean) => void;
	toggleOpen: () => void;
	toggleModalMode: () => void;
}

export interface DiffModalInfo {
	prompt: string;
}

export interface CanvasChatController {
	messages: {
		data: Message[];
		loading: boolean;
	};
	ui: ChatUIState;
	actions: {
		sendMessage: () => Promise<void>;
		sendMessageWithText: (text: string) => Promise<void>;
		createNewChat: () => Promise<void>;
		handleKeyPress: (e: React.KeyboardEvent) => void;
		setIsOpen: (value: boolean) => void;
		setIsModalMode: (value: boolean) => void;
		setMessage: React.Dispatch<React.SetStateAction<string>>;
		setMode: (value: string) => void;
		setIsRecording: (value: boolean) => void;
		toggleOpen: () => void;
		toggleModalMode: () => void;
	};
	audit: {
		showModal: boolean;
		currentData: any;
		isLoading: boolean;
		isFixing: boolean;
		onClose: () => void;
		onRun: () => Promise<void>;
		onFix: (recommendations: string[]) => Promise<void>;
	};
	diff: {
		modalInfo: DiffModalInfo | null;
		onChange: (value: string) => void;
		onSave: (value: string) => void;
		onClose: () => void;
	};
	messagesRef: React.RefObject<HTMLDivElement | null>;
}

export interface UseCanvasChatAPIProps {
	promptId?: number;
}

export interface UseCanvasChatMessagesProps {
	promptId?: number;
}

export interface UseCanvasChatActionsProps {
	onEditPrompt: (value: string) => void;
	onAuditPrompt: (value: any) => void;
}
