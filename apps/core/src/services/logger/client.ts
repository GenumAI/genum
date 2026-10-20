/**
 * The ClickHouse connection: the client every logger read and write goes through, and the
 * names of the tables they address.
 */

import { createClient } from "@clickhouse/client";
import { env } from "@/env";

export const clickhouseUrl = env.CLICKHOUSE_URL;
export const clickhouseDatabase = env.CLICKHOUSE_DB;
const clickhouseUsername = env.CLICKHOUSE_USER;
const clickhousePassword = env.CLICKHOUSE_PASSWORD;

export enum CLICKHOUSE_TABLES {
	LOGS = "logs",
	TRACE_SPANS = "trace_spans",
}

export const clickhouseClient = createClient({
	url: clickhouseUrl,
	database: clickhouseDatabase,
	username: clickhouseUsername,
	password: clickhousePassword,
});

/**
 * A client bound to NO database, for the one statement that cannot assume one exists:
 * CREATE DATABASE.
 *
 * `clickhouseClient` above sends its session database with every request, so using it to
 * bootstrap answers `Database <name> does not exist.` -- and the init script this
 * replaces classified that message as benign, which is how a fresh environment came to be
 * "initialised successfully" into nothing.
 */
export function createAdminClickhouseClient() {
	return createClient({
		url: clickhouseUrl,
		username: clickhouseUsername,
		password: clickhousePassword,
	});
}
