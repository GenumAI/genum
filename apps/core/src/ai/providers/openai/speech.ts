import OpenAI from "openai";
import * as fs from "node:fs";
import * as fsPromises from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";

export async function transcribeOpenAI(key: string, audio: string | Buffer): Promise<string> {
	const openai = new OpenAI({ apiKey: key, timeout: 600_000, maxRetries: 5 });
	let tempFile: string | null = null;

	try {
		// Validate input
		if (!audio) {
			throw new Error("Audio data is required");
		}

		if (!key) {
			throw new Error("API key is required");
		}

		// Create a unique temporary file path with proper extension
		tempFile = path.join(os.tmpdir(), `audio-${Date.now()}.webm`);

		// Handle both string and Buffer inputs
		let audioBuffer: Buffer;
		if (Buffer.isBuffer(audio)) {
			audioBuffer = audio;
		} else if (typeof audio === "string") {
			if (audio.startsWith("data:")) {
				// Handle base64 data URL
				const base64Data = audio.split(";base64,").pop();
				if (!base64Data) {
					throw new Error("Invalid base64 audio data");
				}
				audioBuffer = Buffer.from(base64Data, "base64");
			} else {
				// Handle raw binary string
				audioBuffer = Buffer.from(audio, "binary");
			}
		} else {
			throw new Error("Invalid audio data format");
		}

		// Ensure the temp directory exists
		await fsPromises.mkdir(os.tmpdir(), { recursive: true });

		// Write buffer to temporary file
		await fsPromises.writeFile(tempFile, audioBuffer);

		// Verify file exists and has content
		const stats = await fsPromises.stat(tempFile);
		if (stats.size === 0) {
			throw new Error("Audio file is empty");
		}

		// Create transcription
		const transcription = await openai.audio.transcriptions.create({
			// todo count tokens and costs for transcriptions
			file: fs.createReadStream(tempFile),
			model: "whisper-1",
			response_format: "text",
		});

		return transcription;
	} catch (error) {
		console.error("Error in speechToText:", error);
		throw error;
	} finally {
		// Clean up: delete the temporary file if it exists
		if (tempFile) {
			try {
				const exists = await fsPromises
					.access(tempFile)
					.then(() => true)
					.catch(() => false);

				if (exists) {
					await fsPromises.unlink(tempFile);
				}
			} catch (error) {
				// Log cleanup error but don't throw since the main operation is complete
				console.error("Warning: Error cleaning up temporary file:", error);
			}
		}
	}
}
