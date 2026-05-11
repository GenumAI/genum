import { expect, test } from "../../../fixtures/test";
import {
  getNotifications,
  getWorkspaceFromPage,
  markAllNotificationsAsRead,
} from "../../../support/api-client";

test("notifications list and details routes open", async ({
  layoutPage,
  notificationsPage,
  page,
}) => {
  await layoutPage.openHome();
  const workspace = await getWorkspaceFromPage(page);

  await notificationsPage.openList(workspace.orgId, workspace.projectId);

  const openedDetails = await notificationsPage.openFirstNotificationDetailsIfAny();
  if (!openedDetails) {
    await page.goto(
      `/${workspace.orgId}/${workspace.projectId}/notifications/non-existent-notification`,
    );
    await expect(page).toHaveURL(/\/notifications\/non-existent-notification$/);
    await expect(page.getByText("Notification not found")).toBeVisible();
  }
});

test("mark-as-read behavior", async ({ layoutPage, notificationsPage, page }) => {
  await layoutPage.openHome();
  const workspace = await getWorkspaceFromPage(page);

  await notificationsPage.openList(workspace.orgId, workspace.projectId);
  await notificationsPage.markAllAsReadIfAvailable();

  await markAllNotificationsAsRead(page);
  const notifications = await getNotifications(page);
  expect(notifications.every((item) => item.read !== false)).toBeTruthy();
});
