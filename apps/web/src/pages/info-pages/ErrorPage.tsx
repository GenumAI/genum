import { useMemo } from "react";
import { isRouteErrorResponse, useRouteError } from "react-router-dom";

import { Button } from "@/components/ui/button";

export function ErrorPage() {
	// This is mounted as a router `errorElement`, which receives nothing through props -- the
	// error is only reachable through useRouteError(). Reading it from a prop meant every
	// failure, including a page chunk that failed to load, rendered the bare "Unknown Error".
	const error = useRouteError();

	const content = useMemo(() => {
		if (isRouteErrorResponse(error)) {
			return (
				<>
					<h2>
						{error.status} {error.statusText}
					</h2>
					<p>{error.data}</p>
				</>
			);
		} else if (error instanceof Error) {
			return (
				<div>
					<h2>Error</h2>
					<p>{error.message}</p>
					<p>The stack trace is:</p>
					<pre>{error.stack}</pre>
				</div>
			);
		} else {
			return <h2>Unknown Error</h2>;
		}
	}, [error]);

	return (
		<div className="h-screen w-screen flex flex-col items-center gap-4 justify-center">
			{content}
			<Button variant="outline" onClick={() => window.location.reload()}>
				Reload
			</Button>
		</div>
	);
}
