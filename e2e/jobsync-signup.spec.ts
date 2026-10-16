import { test, expect } from "@playwright/test";

test("JobSync signup flow", async ({ page }) => {
  const email =
    `jobsync.test.${Date.now()}@example.com`;
  const password = "Test@123456";
  const name = "JobSync Test";

  console.log("TEST EMAIL:", email);

  await page.goto("http://localhost:3737/signup");

  await expect(
    page.getByRole("heading", { name: "Get started" })
  ).toBeVisible();

  await page.getByLabel("Full Name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByRole("textbox", { name: "Password" }).fill(password);

  await page.getByRole("button", {
    name: "Create an account",
  }).click();

  await page.waitForURL("**/dashboard", {
    timeout: 15000,
  });

  console.log("FINAL URL:", page.url());

  await expect(page).toHaveURL(/\/dashboard/);

  console.log("SIGNUP + SIGNIN + DASHBOARD: PASS");
});
