import React, { useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { helpersApi, ContentPrettifyResponse } from "@/api/helpers";
import { useQuery } from "@tanstack/react-query";

interface AIPreviewProps {
	content: string;
	onError?: (error: string) => void;
}

const AIPreview: React.FC<AIPreviewProps> = ({ content, onError }) => {
	const onErrorRef = useRef(onError);

	// Normalize content to ensure consistent cache keys
	const normalizedContent = content?.trim() || "";

	// Create a cache key based on content - React Query will cache results automatically
	const cacheKey = ["content-prettify", normalizedContent];

	// Use query for caching - it will cache based on content
	// Set staleTime to Infinity so React Query won't refetch cached data
	const {
		data,
		isLoading,
		error: queryError,
	} = useQuery<ContentPrettifyResponse>({
		queryKey: cacheKey,
		queryFn: async () => {
			return await helpersApi.contentPrettify({ content: normalizedContent });
		},
		staleTime: Infinity, // Never consider data stale, use cache forever
		gcTime: Infinity, // Keep cache forever (formerly cacheTime)
		refetchOnMount: false, // Don't refetch when component mounts if data exists in cache
		refetchOnWindowFocus: false, // Don't refetch when window regains focus
		refetchOnReconnect: false, // Don't refetch on reconnect
	});

	// Keep onError ref up to date
	useEffect(() => {
		onErrorRef.current = onError;
	}, [onError]);

	// Call onError callback when error occurs
	useEffect(() => {
		if (queryError && onErrorRef.current) {
			const errorMsg =
				queryError instanceof Error ? queryError.message : "Failed to prettify content";
			onErrorRef.current(errorMsg);
		}
	}, [queryError]);

	// Loading state
	if (isLoading) {
		return (
			<div className="flex items-center justify-center py-8">
				<div className="flex flex-col items-center gap-2">
					<div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
					<p className="text-sm text-muted-foreground">Prettifying content...</p>
				</div>
			</div>
		);
	}

	// Error state
	if (queryError) {
		const errorMsg =
			queryError instanceof Error ? queryError.message : "Failed to prettify content";
		return (
			<div className="space-y-2">
				<div className="rounded-md border border-destructive/50 bg-destructive/10 p-3">
					<p className="text-sm font-medium text-destructive">⚠️ Error: {errorMsg}</p>
					<p className="mt-2 text-xs text-muted-foreground">
						Showing original content below
					</p>
				</div>
				<pre className="whitespace-pre-wrap font-mono text-sm overflow-x-auto rounded-md border p-4">
					{content}
				</pre>
			</div>
		);
	}

	// Success state - show prettified markdown
	if (data?.text) {
		return (
			<div
				className="markdown-content w-full max-w-full overflow-x-hidden"
				style={{ wordBreak: "break-word", overflowWrap: "break-word" }}
			>
				<div
					className="w-full max-w-full overflow-x-hidden"
					style={{ wordBreak: "break-word", overflowWrap: "break-word" }}
				>
					<ReactMarkdown
						remarkPlugins={[remarkGfm]}
						components={{
							p: ({ children }) => (
								<p className="leading-relaxed break-words mb-2 last:mb-0">
									{children}
								</p>
							),
							code: ({ children }) => (
								<code className="bg-muted px-1 py-0.5 rounded text-xs break-words">
									{children}
								</code>
							),
							blockquote: ({ children }) => (
								<blockquote className="border-l-2 border-muted-foreground pl-4 italic mb-2 last:mb-0 break-words">
									{children}
								</blockquote>
							),
							h1: ({ children }) => (
								<h1 className="text-lg font-bold mb-2 mt-2 last:mb-0 break-words">
									{children}
								</h1>
							),
							h2: ({ children }) => (
								<h2 className="text-base font-bold mb-2 mt-6 last:mb-0 break-words">
									{children}
								</h2>
							),
							h3: ({ children }) => (
								<h3 className="text-sm font-bold mb-2 mt-6 last:mb-0 break-words">
									{children}
								</h3>
							),
							ul: ({ children }) => (
								<ul className="list-disc pl-5 space-y-1 mb-2 last:mb-0 break-words">
									{children}
								</ul>
							),
							ol: ({ children }) => (
								<ol className="list-decimal pl-5 space-y-1 mb-2 last:mb-0 break-words">
									{children}
								</ol>
							),
							li: ({ children }) => <li className="ml-2 break-words">{children}</li>,
							strong: ({ children }) => (
								<strong className="font-semibold break-words">{children}</strong>
							),
							em: ({ children }) => (
								<em className="italic break-words">{children}</em>
							),
							del: ({ children }) => (
								<del className="line-through break-words">{children}</del>
							),
							a: ({ children, href }) => (
								<a
									href={href}
									target="_blank"
									rel="noopener noreferrer"
									className="text-blue-500 underline break-words"
								>
									{children}
								</a>
							),
							pre: ({ children }) => (
								<pre className="bg-muted p-2 rounded-md overflow-x-auto text-xs mb-2 last:mb-0 break-words">
									{children}
								</pre>
							),
						}}
					>
						{data.text}
					</ReactMarkdown>
				</div>
			</div>
		);
	}

	// Fallback - show original content
	return <pre className="whitespace-pre-wrap font-mono text-sm overflow-x-auto">{content}</pre>;
};

export default AIPreview;
