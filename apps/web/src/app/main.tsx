import React from "react";
import ReactDOM from "react-dom/client";
import "@/lib/monaco-setup";
import "./../index.css";
import App, { AppRoot } from "./App";
import { AuthProvider } from "@/app/AuthProvider";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const queryClient = new QueryClient();

// Firefox detection and fixes
const isFirefox = navigator.userAgent.toLowerCase().includes("firefox");
if (isFirefox) {
	document.documentElement.classList.add("firefox");
}

// commit for testing testing testing

ReactDOM.createRoot(document.getElementById("root")!).render(
	<QueryClientProvider client={queryClient}>
		<AuthProvider>
			<AppRoot>
				<div id="app-scale">
					<App />
				</div>
			</AppRoot>
		</AuthProvider>
	</QueryClientProvider>,
);
