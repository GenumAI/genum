import type React from "react";

interface ModelConfigCardProps {
	vendor: string;
	name: string;
	params: [string, string][];
}

export const ModelConfigCard: React.FC<ModelConfigCardProps> = ({
	vendor,
	name,
	params,
}) => {
	return (
		<div>
			<h3 className="text-base font-semibold text-foreground mb-2">Model Configuration</h3>
			<div className="mb-4">
				<span className="text-sm text-foreground font-medium">
					{vendor}/{name}
				</span>
			</div>
			{params.length > 0 && (
				<div className="overflow-hidden rounded-md border border-border">
					<table className="w-full text-sm text-left rounded-lg bg-card text-card-foreground">
						<thead className="bg-muted">
							<tr className="border-b border-border">
								<th className="py-2 px-4 font-medium w-[311px] border-r border-border">
									Parameter
								</th>
								<th className="py-2 px-4 font-medium">Value</th>
							</tr>
						</thead>
						<tbody>
							{params.map(([param, value]) => (
								<tr
									key={param}
									className="border-b border-border [&:last-child]:border-b-0"
								>
									<td className="py-2 px-4 text-muted-foreground w-[311px] border-r border-border">
										{param}
									</td>
									<td className="py-2 px-4 text-foreground">{value}</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
		</div>
	);
};
