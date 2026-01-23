import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/useToast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, CheckCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { NotificationIcon } from "@/components/ui/icons-tsx/NotificationIcon";
import { userApi, Notification } from "@/api/user";
import { formatNotificationPreview } from "@/lib/notificationPreview";

export default function Notifications() {
	const { toast } = useToast();
	const navigate = useNavigate();
	const { orgId, projectId } = useParams<{ orgId: string; projectId: string }>();

	const [currentPage, setCurrentPage] = useState(1);
	const [totalPages, setTotalPages] = useState(1);
	const [totalCount, setTotalCount] = useState(0);
	const [notifications, setNotifications] = useState<Notification[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const limit = 5;

	const fetchNotifications = useCallback(async () => {
		try {
			setIsLoading(true);
			const response = await userApi.getNotifications({ page: currentPage, limit: limit });

			setNotifications(response.notifications);

			if (response.pagination) {
				setTotalCount(response.pagination.totalCount || 0);
				setTotalPages(response.pagination.totalPages || 1);
				if (response.pagination.currentPage) {
				}
			} else {
				setTotalCount(response.totalCount || 0);
				setTotalPages(Math.ceil((response.totalCount || 0) / limit));
			}
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
	}, [currentPage, limit, toast]);

	useEffect(() => {
		fetchNotifications();
	}, [fetchNotifications]);

	const handlePageChange = (page: number) => {
		if (page >= 1 && page <= totalPages) {
			setCurrentPage(page);
		}
	};

	const markAsRead = async (notificationId: string) => {
		try {
			await userApi.markNotificationAsRead(notificationId);
			fetchNotifications();
		} catch (error) {
			console.error("Error marking notification as read:", error);
		}
	};

	const markAllAsRead = async () => {
		try {
			await userApi.markAllNotificationsAsRead();
			toast({
				title: "Success",
				description: "All notifications marked as read.",
				duration: 3000,
			});
			fetchNotifications();
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

	const handleViewNotification = (notificationId: string) => {
		const notification = notifications.find((n) => n.id === notificationId);
		if (notification && notification.read === false) {
			markAsRead(notificationId);
		}

		navigate(`/${orgId}/${projectId}/notifications/${notificationId}`);
	};

	const formatDate = (dateString: string) => {
		const date = new Date(dateString);
		const now = new Date();
		const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));

		if (diffInHours < 1) return "Just now";
		if (diffInHours < 24) return `${diffInHours}h ago`;
		if (diffInHours < 168) return `${Math.floor(diffInHours / 24)}d ago`;
		return date.toLocaleDateString();
	};

	const unreadCount = notifications.filter((n) => !n.read).length;

	return (
		<div className="space-y-6 max-w-[1232px] 2xl-plus:max-w-[70%] 2xl-plus:min-w-[1232px] 2xl-plus:w-[70%] ml-3 mr-6 w-full mt-8">
			{/* Header with Mark All as Read button */}
			{!isLoading && notifications.length > 0 && (
				<div className="flex items-center gap-2">
					<Button
						onClick={markAllAsRead}
						variant="ghost"
						size="sm"
						disabled={unreadCount === 0}
						className="text-xs h-8 px-3"
					>
						<CheckCircle className="h-3 w-3 mr-1" />
						Mark all as read
					</Button>
				</div>
			)}

			{isLoading ? (
				<div className="flex items-center justify-center py-12">
					<div className="text-sm text-gray-500">Loading notifications...</div>
				</div>
			) : notifications.length === 0 ? (
				<div className="flex flex-col items-center justify-center py-12 text-center">
					<Bell className="h-12 w-12 text-gray-400 mb-4" />
					<h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
						No notifications
					</h3>
					<p className="text-sm text-gray-500">
						You're all caught up! Check back later for updates.
					</p>
				</div>
			) : (
				<div className="space-y-4">
					{notifications.map((notification) => (
						<div
							key={notification.id}
							onClick={() => handleViewNotification(notification.id)}
							className={`p-4 rounded-lg border transition-colors cursor-pointer`}
						>
							<div className="flex items-start gap-4">
								<NotificationIcon size="lg" />
								<div className="flex-1 min-w-0">
									<div className="flex items-center gap-3 mb-2">
										<h3 className="text-base font-medium text-gray-900 dark:text-gray-100">
											{notification.title}
										</h3>
										{notification.read === false && (
											<div className="h-2 w-2 bg-red-500 rounded-full flex-shrink-0" />
										)}
										{notification.type && (
											<Badge variant="outline" className="text-xs">
												{notification.type}
											</Badge>
										)}
									</div>
									<p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
										{formatNotificationPreview(notification.content, 120)}
									</p>
									<div className="flex items-center justify-between">
										<span className="text-xs text-gray-500">
											{formatDate(notification.createdAt)}
										</span>
									</div>
								</div>
							</div>
						</div>
					))}
				</div>
			)}

			{/* Pagination */}
			{!isLoading && notifications.length > 0 && totalPages > 1 && (
				<div className="flex items-center justify-between mt-6">
					<div className="text-sm text-gray-500">
						Showing {(currentPage - 1) * limit + 1} to{" "}
						{Math.min(currentPage * limit, totalCount)} of {totalCount} notifications
					</div>
					<div className="flex items-center gap-2">
						<Button
							onClick={() => handlePageChange(currentPage - 1)}
							variant="ghost"
							size="sm"
							disabled={currentPage === 1}
							className="h-8 w-8 p-0"
						>
							<ChevronLeft className="h-4 w-4" />
						</Button>

						{/* Page numbers */}
						{Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
							let pageNum;
							if (totalPages <= 5) {
								pageNum = i + 1;
							} else if (currentPage <= 3) {
								pageNum = i + 1;
							} else if (currentPage >= totalPages - 2) {
								pageNum = totalPages - 4 + i;
							} else {
								pageNum = currentPage - 2 + i;
							}

							return (
								<Button
									key={pageNum}
									onClick={() => handlePageChange(pageNum)}
									variant={currentPage === pageNum ? "default" : "ghost"}
									size="sm"
									className="h-8 w-8 p-0"
								>
									{pageNum}
								</Button>
							);
						})}

						<Button
							onClick={() => handlePageChange(currentPage + 1)}
							variant="ghost"
							size="sm"
							disabled={currentPage === totalPages}
							className="h-8 w-8 p-0"
						>
							<ChevronRight className="h-4 w-4" />
						</Button>
					</div>
				</div>
			)}
		</div>
	);
}
