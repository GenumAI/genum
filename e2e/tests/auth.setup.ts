import { test } from "@playwright/test";
import { createAuthState } from "../support/auth-state";
import { createE2EUser } from "../support/user-data";

test("auth setup", async () => {
  const user = createE2EUser();
  await createAuthState(user);
});
