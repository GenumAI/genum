export interface Log {
	log_lvl: string;
	timestamp: string;
	source: string;
	vendor: string;
	model: string;
	tokens_sum: number;
	cost: number;
	response_ms: number;
	description?: string;
	tokens_in?: number;
	tokens_out?: number;
	in?: string;
	out?: string;
	log_type?: string;
	user_name?: string;
	memory_key?: string;
	api?: string;
	prompt_id?: number;
}

export interface LogsResponse {
	logs: Log[];
	total: number;
}

export interface MemoryRecord {
	id: number;
	key: string;
}

export interface MemoriesResponse {
	memories: MemoryRecord[];
}

export interface PromptName {
	id: number;
	name: string;
}
