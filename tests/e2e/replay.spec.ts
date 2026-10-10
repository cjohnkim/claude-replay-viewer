import { test, expect } from "@playwright/test";

test("inspect context at action time, authorize, post, rewind and reset", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.goto("/demo/ach");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("A closed account");
  await expect(page.getByTestId("context-before")).toContainText("No evidence had been delivered");
  await expect(page.getByTestId("context-before")).not.toContainText("posting-receipt");
  await expect(page.getByRole("complementary", { name: "Case transcript" })).toContainText("13:00:00 UTC");
  await page.getByRole("button", { name: "Go to event 5: Pause: three facts are still missing", exact: true }).click();
  await expect(page.getByTestId("policy-decision")).toContainText("needs evidence");
  await expect(page.getByTestId("context-before")).not.toContainText("return-receipt-v2");
  await page.getByRole("button", { name: "Go to event 14: Reopen for this return credit only", exact: true }).click();
  await expect(page.getByTestId("business-state")).toContainText("return credit only");
  await expect(page.getByTestId("posting-receipt")).toHaveText("No posting yet");
  await page.getByRole("button", { name: "Go to event 18: Post the return and record the receipt", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Balanced ledger effects" })).toBeVisible();
  await expect(page.getByTestId("posting-receipt")).toHaveText("posting-SYN-0042");
  await expect(page.getByTestId("business-state")).toContainText("$4,800.00");
  await page.screenshot({ path: "test-results/ach-demo-desktop.png" });
  await page.getByTestId("authorization-trail").getByRole("button", { name: /decision-02/ }).click();
  await expect(page.getByTestId("event-title")).toHaveText("Authorize a restricted account-state change");
  await expect(page.getByTestId("posting-receipt")).toHaveText("No posting yet");
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(page.getByTestId("event-title")).toHaveText("Incoming return requires investigation");
  expect(errors).toEqual([]);
});

test("agent, event and empty-search filters preserve the global cursor", async ({ page }) => {
  await page.goto("/demo/ach");
  await page.getByTitle("Jump to end", { exact: true }).click();
  await page.getByLabel("Agent", { exact: true }).selectOption("evidence-agent");
  const transcript = page.getByRole("complementary", { name: "Case transcript" });
  await expect(transcript.locator("[data-event-id]")).toHaveCount(4);
  await expect(page.getByTestId("posting-receipt")).toHaveText("posting-SYN-0042");
  await page.getByLabel("Event", { exact: true }).selectOption("ledger_posting");
  await expect(transcript).toContainText("No events match these filters");
  await page.getByRole("button", { name: "Clear filters" }).click();
  await page.getByRole("textbox", { name: "Search transcript" }).fill("no-such-event-zz");
  await expect(transcript).toContainText("No events match these filters");
  await expect(page.getByTestId("event-title")).toContainText("Exception resolved");
});

test("playback advances, stops at end and scenario changes reset playback", async ({ page }) => {
  await page.goto("/demo/ach");
  await page.getByRole("button", { name: "4×", exact: true }).click();
  await page.getByTitle("Play", { exact: true }).click();
  await expect(page.getByTestId("event-title")).not.toHaveText("Incoming return requires investigation");
  await page.getByTitle("Pause", { exact: true }).click();
  await page.getByLabel("Scenario").selectOption("missing-evidence");
  await expect(page.getByTestId("event-title")).toHaveText("Incoming return requires investigation");
  await expect(page.getByTitle("Play", { exact: true })).toBeVisible();
  await page.getByTitle("Jump to end", { exact: true }).click();
  await page.getByTitle("Previous meaningful change", { exact: true }).click();
  await page.getByRole("button", { name: "4×", exact: true }).click();
  await page.getByTitle("Play", { exact: true }).click();
  await expect(page.getByTestId("event-title")).toHaveText("Review required; funds remain unallocated");
  await expect(page.getByTitle("Play", { exact: true })).toBeVisible();
  await expect(page.getByTestId("posting-receipt")).toHaveText("No posting yet");
});

for (const scenario of ["missing-evidence", "blocked-account"] as const) {
  test(`${scenario}: no financial write at the end`, async ({ page }) => {
    await page.goto("/demo/ach");
    await page.getByLabel("Scenario").selectOption(scenario);
    await page.getByTitle("Jump to end", { exact: true }).click();
    await expect(page.getByTestId("business-state")).toContainText("held");
    await expect(page.getByTestId("business-state")).toContainText("closed");
    await expect(page.getByTestId("posting-receipt")).toHaveText("No posting yet");
    await expect(page.getByTestId("authorization-trail")).toContainText(scenario === "blocked-account" ? "deny" : "needs evidence");
  });
}

test("duplicate delivery retains a single receipt", async ({ page }) => {
  await page.goto("/demo/ach");
  await page.getByLabel("Scenario").selectOption("duplicate-delivery");
  await page.getByRole("button", { name: "Go to event 19: Suppress a duplicate delivery", exact: true }).click();
  await expect(page.getByRole("main", { name: "Event inspection" })).toContainText('"duplicate": true');
  await expect(page.getByTestId("posting-receipt")).toHaveText("posting-SYN-0042");
});

test("Claude picker, ingestion, event inspection and shared timeline still work", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.goto("/");
  await expect(page.getByRole("link", { name: /Twisp Lens ACH demo/ })).toBeVisible();
  await expect(page.getByText("How do I add a hello page?", { exact: true }).first()).toBeVisible();
  await page.goto("/session/claude-regression");
  await expect(page.getByText("How do I add a hello page?", { exact: true }).first()).toBeVisible();
  await page.getByTitle("Jump to end", { exact: true }).click();
  await expect(page.getByRole("main")).toContainText("The hello page is ready.");
  await page.getByTitle("Jump to start", { exact: true }).click();
  await page.locator('[data-event-id]').filter({ hasText: "I will add a small hello page." }).click();
  await expect(page.getByRole("main")).toContainText("I will add a small hello page.");
  await page.getByTitle("Jump to start", { exact: true }).click();
  await page.getByRole("button", { name: "4×", exact: true }).click();
  await page.getByTitle("Play", { exact: true }).click();
  await expect(page.getByRole("main")).toContainText("The hello page is ready.");
  await expect(page.getByTitle("Play", { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test("small viewport remains usable without page-level horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/demo/ach");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.screenshot({ path: "test-results/ach-demo-mobile.png", fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByLabel("Scenario").selectOption("blocked-account");
  await page.getByTitle("Jump to end", { exact: true }).click();
  await expect(page.getByTestId("posting-receipt")).toHaveText("No posting yet");
});
