import { defineConfig } from "@playwright/test";
import path from "node:path";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: { baseURL: "http://127.0.0.1:3034", viewport: { width: 1440, height: 1000 }, trace: "retain-on-failure" },
  webServer: {
    command: "npm run dev -- -p 3034",
    url: "http://127.0.0.1:3034/demo/ach",
    reuseExistingServer: false,
    env: { CLAUDE_PROJECTS_DIR: path.resolve("tests/fixtures/claude") },
    timeout: 120_000,
  },
});
