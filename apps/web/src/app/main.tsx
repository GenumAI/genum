import React from "react";
import ReactDOM from "react-dom/client";
import "./../index.css";
import App, { AppRoot } from "./App";
import { AuthProvider } from "@/app/AuthProvider";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const queryClient = new QueryClient();

// Firefox detection and fixes
const isFirefox = navigator.userAgent.toLowerCase().includes("firefox");
if (isFirefox) {
	document.documentElement.classList.add("firefox");

	// Disable zoom for Firefox to prevent Monaco Editor issues
	const disableZoom = () => {
		const viewport = document.querySelector("meta[name=viewport]");
		if (viewport) {
			viewport.setAttribute(
				"content",
				"width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no",
			);
		}
	};

	disableZoom();

	// Re-disable zoom on resize
	window.addEventListener("resize", disableZoom);
}

// const handleRedirectCallback = (appState: any) => {
//   if (appState.inviteToken) {
//     window.location.href = `/invite/${appState.inviteToken}`;
//   }
//   // Убираем принудительный редирект на главную страницу
//   // Auth0 автоматически обработает редирект после аутентификации
// }

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