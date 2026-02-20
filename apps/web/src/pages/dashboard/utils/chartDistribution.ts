export interface DistributionModelInput {
	model: string;
	total_requests: number;
}

export interface DistributionChartEntry {
	name: string;
	value: number;
}

export function getDistributionTotal(models: DistributionModelInput[]): number {
	return models.reduce((sum, model) => sum + model.total_requests, 0);
}

export function toDistributionChartData(
	models: DistributionModelInput[],
): DistributionChartEntry[] {
	return models.map((model) => ({
		name: model.model,
		value: model.total_requests,
	}));
}

export function buildColorByNameMap(
	chartData: DistributionChartEntry[],
	colors: string[],
): Map<string, string> {
	return new Map(
		chartData.map((entry, index) => [entry.name, colors[index % colors.length]]),
	);
}
