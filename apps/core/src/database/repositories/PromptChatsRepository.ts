import type { PrismaClient } from "@/prisma";
import type { StoredMessage } from "@langchain/core/messages";
import type { InputJsonValue } from "@prisma/client/runtime/client";

export class PromptChatsRepository {
	private prisma: PrismaClient;

	constructor(prisma: PrismaClient) {
		this.prisma = prisma;
	}

	public async getPromptChatByPromptId(promptId: number, userId: number) {
		return await this.prisma.promptChat.findUnique({
			where: { userId_promptId: { promptId, userId } },
		});
	}

	public async newPromptChat(promptId: number, userId: number) {
		return await this.prisma.promptChat.create({
			data: { promptId, userId },
		});
	}

	public async newChatStart(promptId: number, userId: number) {
		// get promptChat
		const promptChat = await this.prisma.promptChat.findUnique({
			where: { userId_promptId: { promptId, userId } },
		});
		if (promptChat) {
			await this.prisma.promptChatMessage.deleteMany({
				where: { promptChatId: promptChat.id },
			});
		}

		return await this.prisma.promptChat.upsert({
			where: { userId_promptId: { promptId, userId } },
			update: { thread_id: null },
			create: {
				promptId,
				userId,
				thread_id: null,
			},
		});
	}

	public async saveChatMessages(chatId: number, messages: StoredMessage[]) {
		return await this.prisma.promptChatMessage.createMany({
			data: messages.map((message) => ({
				promptChatId: chatId,
				message: message as unknown as InputJsonValue,
			})),
		});
	}

	public async getChatMessages(chatId: number) {
		return await this.prisma.promptChatMessage.findMany({
			where: { promptChatId: chatId },
			orderBy: {
				id: "asc",
			},
		});
	}
}
