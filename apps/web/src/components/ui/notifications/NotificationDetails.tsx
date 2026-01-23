import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/useToast";
import { Button } from "@/components/ui/button";
import { Bell, Calendar, ArrowLeft, RefreshCw } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { NotificationIcon } from "@/components/ui/icons-tsx/NotificationIcon";
import { userApi, type Notification as UserNotification } from "@/api/user/user.api";

export default function NotificationDetails() {
	const { toast } = useToast();
	const navigate = useNavigate();
	const { orgId, projectId, notificationId } = useParams<{
		orgId: string;
		projectId: string;
		notificationId: string;
	}>();

	const [notification, setNotification] = useState<UserNotification | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const requestSeq = useRef(0);

	const fetchNotification = useCallback(async () => {
		if (!notificationId) return;

		const seq = ++requestSeq.current;
		setIsLoading(true);
		try {
			const data = await userApi.getNotification(notificationId);
			if (seq === requestSeq.current) {
				setNotification(data);
			}
		} catch (error) {
			console.error("Error fetching notification:", error);
			toast({
				title: "Error",
				description: "Failed to load notification details.",
				variant: "destructive",
				duration: 3000,
			});
			navigate(`/${orgId}/${projectId}/notifications`);
		} finally {
			if (seq === requestSeq.current) {
				setIsLoading(false);
			}
		}
	}, [navigate, notificationId, orgId, projectId, toast]);

	useEffect(() => {
		fetchNotification();
	}, [fetchNotification]);

	useEffect(() => {
		if (!notificationId) {
			navigate(`/${orgId}/${projectId}/notifications`);
		}
	}, [notificationId, orgId, projectId, navigate]);

	const handleRefresh = () => {
		if (notificationId) {
			fetchNotification();
		}
	};

	const formatDate = (dateString: string) => {
		const date = new Date(dateString);
		return date.toLocaleString("en-US", {
			year: "numeric",
			month: "long",
			day: "numeric",
			hour: "2-digit",
			minute: "2-digit",
		});
	};

	if (isLoading) {
		return (
			<div className="space-y-6">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-4">
						<Button
							onClick={() => navigate(`/${orgId}/${projectId}/notifications`)}
							variant="outline"
							size="sm"
							className="flex items-center gap-2"
						>
							<ArrowLeft className="h-4 w-4" />
							Back to Notifications
						</Button>
					</div>
					<Button
						onClick={handleRefresh}
						variant="outline"
						size="sm"
						disabled={isLoading}
						className="flex items-center gap-2"
					>
						<RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
						Refresh
					</Button>
				</div>

				<div className="flex items-center justify-center py-12">
					<div className="text-sm text-gray-500">Loading notification...</div>
				</div>
			</div>
		);
	}

	if (!notification) {
		return (
			<div className="space-y-6">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-4">
						<Button
							onClick={() => navigate(`/${orgId}/${projectId}/notifications`)}
							variant="outline"
							size="sm"
							className="flex items-center gap-2"
						>
							<ArrowLeft className="h-4 w-4" />
							Back to Notifications
						</Button>
					</div>
				</div>

				<div className="flex flex-col items-center justify-center py-12 text-center">
					<Bell className="h-12 w-12 text-gray-400 mb-4" />
					<h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
						Notification not found
					</h3>
					<p className="text-sm text-gray-500">This notification could not be loaded.</p>
				</div>
			</div>
		);
	}

	return (
		<div className="space-y-6 max-w-[1232px] 2xl-plus:max-w-[70%] 2xl-plus:min-w-[1232px] 2xl-plus:w-[70%] ml-3 mr-6 w-full mt-8 pl-4">
			<div className="flex items-center justify-between">
				<Button
					onClick={() => navigate(`/${orgId}/${projectId}/notifications`)}
					variant="ghost"
					size="sm"
					className="flex items-center gap-2"
				>
					<ArrowLeft className="h-4 w-4" />
					Back to Notifications
				</Button>
			</div>
			<div className="mx-auto">
				<div className="rounded-lg">
					<div className="space-y-6">
						<div className="flex items-start gap-6">
							<NotificationIcon size="lg" />
							<div className="flex-1 min-w-0">
								<div className="flex items-center gap-3 mb-4">
									<h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
										{notification.title}
									</h1>
								</div>

								<div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
									<Calendar className="h-4 w-4" />
									<span>{formatDate(notification.createdAt)}</span>
								</div>
							</div>
						</div>
						<div className="prose prose-lg max-w-none">
							<div className="text-gray-700 dark:text-gray-300 leading-relaxed">
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
										li: ({ children }) => (
											<li className="ml-2 break-words">{children}</li>
										),
										strong: ({ children }) => (
											<strong className="font-semibold break-words">
												{children}
											</strong>
										),
										em: ({ children }) => (
											<em className="italic break-words">{children}</em>
										),
										del: ({ children }) => (
											<del className="line-through break-words">
												{children}
											</del>
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
										img: ({ src, alt }) => (
											<img
												src={src}
												alt={alt ?? ""}
												loading="lazy"
												className="my-6 w-full max-w-[800px] rounded-md border border-muted-foreground/10"
											/>
										),
										pre: ({ children }) => (
											<pre className="bg-muted p-2 rounded-md overflow-x-auto text-xs mb-2 last:mb-0 break-words">
												{children}
											</pre>
										),
										table: ({ children }) => (
											<div className="overflow-x-auto my-6">
												<div className="inline-block w-full max-w-[800px] rounded-lg border border-muted-foreground/20">
													<table className="w-full border-collapse text-sm">
														{children}
													</table>
												</div>
											</div>
										),
										thead: ({ children }) => (
											<thead className="bg-muted/60">{children}</thead>
										),
										tr: ({ children }) => (
											<tr className="border-b border-muted-foreground/20 last:border-0">
												{children}
											</tr>
										),
										th: ({ children }) => (
											<th className="px-4 py-3 text-left font-semibold text-foreground">
												{children}
											</th>
										),
										td: ({ children }) => (
											<td className="px-4 py-3 align-top text-foreground/90">
												{children}
											</td>
										),
									}}
								>
									{notification.content.replace(/\\n/g, "\n")}
								</ReactMarkdown>
								{/* {notification.content.replace(/\n/g, '\n')} */}
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
