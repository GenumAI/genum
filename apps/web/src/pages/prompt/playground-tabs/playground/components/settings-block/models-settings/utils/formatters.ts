/**
 * Format cost value to display with 6 decimal places
 */
export const formatCost = (cost: number): string => `$${cost.toFixed(6)}`;

/**
 * Format response time in milliseconds
 */
export const formatTime = (ms: number): string => `${ms} ms`;
