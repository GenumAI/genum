import { z } from "zod";

export const numberSchema = z.coerce.number().int();

export const stringSchema = z.string();

/** A trace id, matching what the write path validates (`z.uuid()` in prompt.type.ts). */
export const uuidSchema = z.uuid();

export const dateSchema = z.coerce.date();
