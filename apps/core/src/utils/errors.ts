export class HttpError extends Error {
	public readonly statusCode: number;

	constructor(statusCode: number, message: string) {
		super(message);
		this.name = "HttpError";
		this.statusCode = statusCode;
	}
}
