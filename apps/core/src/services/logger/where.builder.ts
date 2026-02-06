/**
 * WhereBuilder - Safe WHERE clause builder with parameterized queries
 * Protects against SQL injection by using query parameters
 */

import type { SourceType, LogLevel } from "./types";

// Type for query parameter values
type QueryParamValue = string | number | number[] | boolean;

export interface QueryParams {
	where: string;
	params: Record<string, QueryParamValue>;
}

export class WhereBuilder {
	private conditions: string[] = [];
	private params: Record<string, QueryParamValue> = {};
	private paramCounter = 0;

	/**
	 * Add organization ID condition
	 */
	orgId(orgId: number): this {
		return this.addCondition("orgId", orgId);
	}

	/**
	 * Add project ID condition
	 */
	projectId(projectId: number): this {
		return this.addCondition("project_id", projectId);
	}

	/**
	 * Add prompt ID condition
	 */
	promptId(promptId: number): this {
		return this.addCondition("prompt_id", promptId);
	}

	/**
	 * Add multiple project IDs condition (IN clause)
	 */
	projectIds(projectIds: number[]): this {
		if (projectIds.length === 0) return this;
		const paramName = this.nextParamName();
		this.conditions.push(`project_id IN {${paramName}: Array(Int64)}`);
		this.params[paramName] = projectIds;
		return this;
	}

	/**
	 * Add date range condition
	 */
	dateRange(fromDate?: string, toDate?: string): this {
		if (fromDate) {
			const paramName = this.nextParamName();
			this.conditions.push(`timestamp >= {${paramName}: DateTime}`);
			this.params[paramName] = `${fromDate} 00:00:00`;
		}
		if (toDate) {
			const paramName = this.nextParamName();
			this.conditions.push(`timestamp <= {${paramName}: DateTime}`);
			this.params[paramName] = `${toDate} 23:59:59`;
		}
		return this;
	}

	/**
	 * Add source condition
	 */
	source(source: SourceType): this {
		return this.addCondition("source", source, "String");
	}

	/**
	 * Add log level condition
	 */
	logLevel(logLevel: LogLevel): this {
		return this.addCondition("log_lvl", logLevel, "String");
	}

	/**
	 * Add user ID condition with NULL check
	 */
	userId(userId?: number): this {
		if (userId === undefined) {
			this.conditions.push("user_id IS NOT NULL");
		} else {
			this.addCondition("user_id", userId);
		}
		return this;
	}

	/**
	 * Add text search in 'in' and 'out' fields (case-insensitive)
	 * Uses positionCaseInsensitive function which is safe for parameterized queries
	 */
	textSearch(query: string): this {
		if (!query.trim()) return this;

		const paramName = this.nextParamName();
		this.conditions.push(
			`(positionCaseInsensitive(\`in\`, {${paramName}: String}) > 0 OR positionCaseInsensitive(\`out\`, {${paramName}: String}) > 0)`,
		);
		this.params[paramName] = query;
		return this;
	}

	/**
	 * Add generic condition
	 */
	private addCondition(field: string, value: QueryParamValue, type: string = "Int64"): this {
		const paramName = this.nextParamName();
		this.conditions.push(`${field} = {${paramName}: ${type}}`);
		this.params[paramName] = value;
		return this;
	}

	/**
	 * Build final WHERE clause and parameters
	 */
	build(): QueryParams {
		return {
			where: this.conditions.length > 0 ? this.conditions.join(" AND ") : "1=1",
			params: this.params,
		};
	}

	/**
	 * Generate next parameter name
	 */
	private nextParamName(): string {
		return `param_${this.paramCounter++}`;
	}

	/**
	 * Static helper to create builder with orgId (most common case)
	 */
	static forOrg(orgId: number): WhereBuilder {
		return new WhereBuilder().orgId(orgId);
	}
}
