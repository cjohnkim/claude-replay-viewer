import { test, expect } from "@playwright/test";

test("swimlane selections reveal handoffs and synchronize knowledge and inspector", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.goto("/demo/ach");
  await expect(page.getByTestId("lane-action")).toHaveCount(20);
  await expect(page.locator('[data-testid="lane-action"][data-reached="true"]')).toHaveCount(1);
  await expect(page.getByTestId("handoff-edge")).toHaveCount(0);
  await expect(page.getByTestId("knowledge-return")).toHaveAttribute("data-count", "0");
  await page.getByRole("button", { name: "After event", exact: true }).click();
  await expect(page.getByTestId("knowledge-return")).toHaveAttribute("data-count", "1");
  await page.getByRole("button", { name: "Return: 1 records", exact: true }).click();
  await expect(page.getByTestId("map-evidence-details")).toContainText("Incoming R02 return");
  await page.getByRole("button", { name: "Select action 10: Receive the investigation dossier", exact: true }).click();
  await expect(page.getByTestId("event-title")).toHaveText("Receive the investigation dossier");
  await expect(page.getByTestId("visual-action-title")).toHaveText("Receive the investigation dossier");
  await expect(page.getByRole("button", { name: "Before action", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("knowledge-original")).toHaveAttribute("data-count", "0");
  await expect(page.getByTestId("handoff-edge").first()).toBeVisible();
  const destinations = await page.getByTestId("handoff-edge").evaluateAll(els => els.map(e => Number(e.getAttribute("data-to"))));
  expect(destinations.every(n => n <= 9)).toBe(true);
  await page.getByRole("button", { name: "After event", exact: true }).click();
  await expect(page.getByTestId("knowledge-original")).toHaveAttribute("data-count", "1");
  await page.getByRole("button", { name: "Original debit: 1 records", exact: true }).click();
  await expect(page.getByTestId("map-evidence-details")).toContainText("Exact scoped match");
  await page.screenshot({ path: "test-results/visual-workspace.png" });
  await page.getByRole("checkbox", { name: "Evidence handoffs" }).uncheck();
  await expect(page.getByTestId("handoff-edge")).toHaveCount(0);
  await page.getByRole("button", { name: "Select action 1: Incoming return requires investigation", exact: true }).click();
  await expect(page.getByTestId("knowledge-original")).toHaveAttribute("data-count", "0");
  await expect(page.getByTestId("map-evidence-details")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("policy gaps, keyboard selection and visual playback work without pulling the page down", async ({ page }) => {
  await page.goto("/demo/ach");
  const policy = page.getByRole("button", { name: "Select action 5: Pause: three facts are still missing", exact: true });
  await policy.focus();
  await page.keyboard.press("Space");
  await expect(page.getByTitle("Play", { exact: true })).toBeVisible();
  await expect(page.getByTestId("visual-policy-gaps")).toContainText("Return funds received");
  await expect(page.getByTestId("knowledge-settlement")).toHaveAttribute("data-count", "0");
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  await page.getByRole("button", { name: "4×", exact: true }).click();
  await page.getByTitle("Play", { exact: true }).click();
  await expect(page.getByTestId("visual-action-title")).not.toHaveText("Pause: three facts are still missing");
  await page.getByRole("button", { name: "After event", exact: true }).click();
  await expect(page.getByTitle("Play", { exact: true })).toBeVisible();
  await page.getByLabel("Scenario").selectOption("blocked-account");
  await page.getByRole("button", { name: "Select action 12: Hold the case: policy does not permit a write", exact: true }).click();
  await expect(page.getByTestId("visual-policy-gaps")).toContainText("Action blocked");
  await expect(page.getByTestId("knowledge-closure")).toHaveAttribute("data-count", "1");
});

test("visualization is collapsible and usable on a narrow viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/demo/ach");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole("button", { name: "After event", exact: true }).click();
  await expect(page.getByTestId("knowledge-return")).toHaveAttribute("data-count", "1");
  await page.getByRole("button", { name: "Hide visualization" }).click();
  await expect(page.getByTestId("swimlanes")).toHaveCount(0);
  await page.getByRole("button", { name: "Show visualization" }).click();
  await expect(page.getByTestId("swimlanes")).toBeVisible();
  await page.screenshot({ path: "test-results/visual-mobile.png", fullPage: true });
});
