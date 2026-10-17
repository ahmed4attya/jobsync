// v5-launch-test.mjs - early headed Edge persistent-context launch (V5 gate)
// M4: system Edge channel only. NO chromium download. headless: false by design.
import { chromium } from "playwright";
import fs from "node:fs";

const PROFILE_DIR = "_private/apply-profile";

async function main() {
  fs.mkdirSync(PROFILE_DIR, { recursive: true });
  const ctx = await chromium.launchPersistentContext(PROFILE_DIR, {
    channel: "msedge",
    headless: false,
  });
  const page = ctx.pages()[0] ?? (await ctx.newPage());
  await page.goto("about:blank");
  await page.waitForTimeout(1500);
  const ua = await page.evaluate(() => navigator.userAgent);
  console.log("UA:", ua.slice(0, 80));
  console.log("PROFILE-DIR:", PROFILE_DIR, "| exists:", fs.existsSync(PROFILE_DIR));
  const pages = ctx.pages().length;
  await ctx.close();
  console.log("PASS: headed msedge persistent context launched and closed cleanly (" + pages + " page)");
  process.exit(0);
}

main().catch((e) => {
  console.error("FAIL:", e && e.message ? e.message : String(e));
  process.exit(1);
});
