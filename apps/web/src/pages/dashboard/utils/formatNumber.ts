/**
 * A whole count with the viewer's digit grouping -- `18,480,446`, not `18480446`. The
 * headline cards, the chart axes, the distributions and the tables all go through this,
 * so the same number never reads two ways on one page.
 */
export function formatCount(value: number): string {
	return Math.round(value).toLocaleString();
}
