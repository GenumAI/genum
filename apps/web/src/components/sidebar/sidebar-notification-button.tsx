import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { userApi, type Notification as UserNotification } from "@/api/user";
import { useToast } from "@/hooks/useToast";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import { Badge } from "@/components/ui/badge";
import { Bell } from "lucide-react";
import { SidebarMenuButton } from "@/components/sidebar/sidebar";
import { NotificationIcon } from "@/components/ui/icons-tsx/NotificationIcon";
import { formatNotificationPreview } from "@/lib/notificationPreview";

export function SidebarNotificationButton() {
	const { toast } = useToast();
	const navigate = useNavigate();
	const { orgId, projectId } = useParams<{
		orgId: string;
		projectId: string;
	}>();

	const [open, setOpen] = useState(false);
	const [notifications, setNotifications] = useState<UserNotification[]>([]);
	const [isLoading, setIsLoading] = useState(false);

	const loadNotifications = useCallback(async () => {
		setIsLoading(true);
		try {
			const data = await userApi.getNotifications({ limit: 3 });
			setNotifications(data.notifications ?? []);
		} catch (error) {
			console.error("Error fetching notifications:", error);
			toast({
				title: "Error",
				description: "Failed to load notifications.",
				variant: "destructive",
				duration: 3000,
			});
		} finally {
			setIsLoading(false);
		}
	}, [toast]);

	useEffect(() => {
		void loadNotifications();
	}, [loadNotifications, orgId, projectId]);

	useEffect(() => {
		if (open) {
			void loadNotifications();
		}
	}, [open, loadNotifications]);

	const handleViewAll = () => {
		setOpen(false);
		navigate(`/${orgId}/${projectId}/notifications`);
	};

	const markAsRead = async (notificationId: string) => {
		try {
			await userApi.markNotificationAsRead(notificationId);
			setNotifications((prev) =>
				prev.map((notification) =>
					notification.id === notificationId
						? {
								...notification,
								read: true,
							}
						: notification,
				),
			);
		} catch (error) {
			console.error("Error marking notification as read:", error);
		}
	};

	const handleViewNotification = (notificationId: string) => {
		// Mark notification as read if it's unread
		const notification = notifications.find((n) => n.id === notificationId);
		if (notification && notification.read === false) {
			markAsRead(notificationId);
		}

		setOpen(false);
		navigate(`/${orgId}/${projectId}/notifications/${notificationId}`);
	};

	const handleMarkAllAsRead = async () => {
		try {
			await userApi.markAllNotificationsAsRead();
			setNotifications((prev) =>
				prev.map((notification) => ({
					...notification,
					read: true,
				})),
			);
			toast({
				title: "Success",
				description: "All notifications marked as read.",
				duration: 3000,
			});
		} catch (error) {
			console.error("Error marking all notifications as read:", error);
			toast({
				title: "Error",
				description: "Failed to mark all notifications as read.",
				variant: "destructive",
				duration: 3000,
			});
		}
	};

	const formatDate = (dateString: string) => {
		const date = new Date(dateString);
		const now = new Date();
		const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));

		if (diffInHours < 1) return "Just now";

		if (diffInHours < 24) return `${diffInHours}h ago`;

		if (diffInHours < 168)
			return `${Math.floor(diffInHours / 24)}
        d ago `;

		return date.toLocaleDateString();
	};

	// Check if there are any unread notifications
	const hasUnreadNotifications = notifications.some(
		(notification) => notification.read === false,
	);

	return (
		<DropdownMenu open={open} onOpenChange={setOpen}>
			<DropdownMenuTrigger asChild>
				<SidebarMenuButton tooltip="What's New">
					<Bell />
					<span className="group-data-[collapsible=icon]:hidden">What's New</span>
					<div className="relative">
						{hasUnreadNotifications && (
							<div className="absolute -top-1 -right-1 h-2 w-2 bg-red-500 rounded-full" />
						)}{" "}
					</div>
				</SidebarMenuButton>
			</DropdownMenuTrigger>
			<DropdownMenuContent className="w-[400px] h-96 flex flex-col" align="end" side="right">
				{/* Fixed Header */}
				<div className="flex-shrink-0 p-3 border-b">
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-2">
							<span className="font-semibold">What's New</span>
						</div>
						{notifications.length > 0 && (
							<div className="flex items-center gap-2 ml-auto">
								<Button
									onClick={handleViewAll}
									variant="ghost"
									size="sm"
									className="text-xs h-6 px-2"
								>
									View All
								</Button>
								<Button
									onClick={handleMarkAllAsRead}
									variant="ghost"
									size="sm"
									className="text-xs h-6 px-2"
								>
									Mark all as Read
								</Button>
							</div>
						)}{" "}
					</div>
				</div>

				{/* Scrollable Content */}
				<div className="flex-1 overflow-y-auto">
					{isLoading ? (
						<div className="flex items-center justify-center py-8">
							<div className="text-sm text-gray-500">Loading notifications...</div>
						</div>
					) : notifications.length === 0 ? (
						<div className="flex flex-col items-center justify-center py-8 text-center">
							<Bell className="h-8 w-8 text-gray-400 mb-2" />
							<div className="text-sm text-gray-500">No new notifications</div>
						</div>
					) : (
						<div className="space-y-1 p-1">
							{notifications.map((notification) => (
								<div
									key={notification.id}
									className="p-1 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
									onClick={() => handleViewNotification(notification.id)}
								>
									<div className="w-full p-3 rounded-lg">
										<div className="flex items-start gap-3">
											<NotificationIcon size="sm" />
											<div className="flex-1 min-w-0">
												<div className="flex items-center gap-2 mb-1">
													<h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
														{notification.title}{" "}
													</h4>
													{notification.read === false && (
														<div className="h-2 w-2 bg-red-500 rounded-full flex-shrink-0" />
													)}{" "}
												</div>
												<p className="text-xs text-gray-600 dark:text-gray-400 mb-2 line-clamp-2">
													{formatNotificationPreview(
														notification.content,
														120,
													)}{" "}
												</p>
												<div className="flex items-center justify-between">
													<span className="text-xs text-gray-500">
														{formatDate(notification.createdAt)}{" "}
													</span>
													<div className="flex items-center gap-2">
														{notification.type && (
															<Badge
																variant="outline"
																className="text-xs"
															>
																{notification.type}{" "}
															</Badge>
														)}{" "}
													</div>
												</div>
											</div>
										</div>
									</div>
								</div>
							))}{" "}
						</div>
					)}{" "}
				</div>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
