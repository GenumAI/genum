import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { TriangleAlert } from "lucide-react";
import type { ValidationAlertProps } from "../../utils/types";

export const ValidationAlert = ({ errors }: ValidationAlertProps) => {
	if (!errors.length) return null;

	return (
		<Alert variant="destructive" className="mb-4">
			<TriangleAlert className="h-4 w-4" />
			<AlertTitle>Schema Validation Errors</AlertTitle>
			<AlertDescription>
				<ul className="list-inside space-y-1">
					{errors.map((error, index) => (
						<li key={`${index}-${error}`}>{error}</li>
					))}
				</ul>
			</AlertDescription>
		</Alert>
	);
};
