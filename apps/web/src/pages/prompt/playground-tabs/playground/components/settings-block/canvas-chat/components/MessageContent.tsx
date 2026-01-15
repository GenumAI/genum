import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MessageContentProps {
	content: string;
}

const markdownComponents = {
	p: ({ children }: any) => (
		<p className="leading-relaxed break-words mb-2 last:mb-0">{children}</p>
	),
	code: ({ children }: any) => (
		<code className="bg-muted px-1 py-0.5 rounded text-xs break-words">{children}</code>
	),
	blockquote: ({ children }: any) => (
		<blockquote className="border-l-2 border-muted-foreground pl-4 italic mb-2 last:mb-0 break-words">
			{children}
		</blockquote>
	),
	h1: ({ children }: any) => (
		<h1 className="text-lg font-bold mb-2 last:mb-0 break-words">{children}</h1>
	),
	h2: ({ children }: any) => (
		<h2 className="text-base font-bold mb-2 last:mb-0 break-words">{children}</h2>
	),
	h3: ({ children }: any) => (
		<h3 className="text-sm font-bold mb-2 last:mb-0 break-words">{children}</h3>
	),
	ul: ({ children }: any) => (
		<ul className="list-disc pl-5 space-y-1 mb-2 last:mb-0 break-words">{children}</ul>
	),
	ol: ({ children }: any) => (
		<ol className="list-decimal pl-5 space-y-1 mb-2 last:mb-0 break-words">{children}</ol>
	),
	li: ({ children }: any) => <li className="ml-2 break-words">{children}</li>,
	strong: ({ children }: any) => (
		<strong className="font-semibold break-words">{children}</strong>
	),
	em: ({ children }: any) => <em className="italic break-words">{children}</em>,
	del: ({ children }: any) => <del className="line-through break-words">{children}</del>,
	a: ({ children, href }: any) => (
		<a
			href={href}
			target="_blank"
			rel="noopener noreferrer"
			className="text-blue-500 underline break-words"
		>
			{children}
		</a>
	),
	pre: ({ children }: any) => (
		<pre className="bg-muted p-2 rounded-md overflow-x-auto text-xs mb-2 last:mb-0 break-words">
			{children}
		</pre>
	),
};

export const MessageContent = React.memo<MessageContentProps>(({ content }) => {
	return (
		<div className="break-words">
			<ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
				{content}
			</ReactMarkdown>
		</div>
	);
});

MessageContent.displayName = "MessageContent";
