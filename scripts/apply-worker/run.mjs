// Apply worker (Phase 2) — host-side, OUTSIDE the container.
// Why host-side: the browser must be headed (owner's screen) for the manual
// confirm flow later; a container has no interactive screen. Documented
// architectural decision (see README.md).
//
// Usage: node scripts/apply-worker/run.mjs <applicationId>
// Extracts the posting's form fields into the draft. NEVER submits anything.
//
// DB target: resolves jobsyncdb/data/dev.db to an ABSOLUTE path from the repo
// root (the host Prisma CLI resolves the .env relative path against the
// schema dir — never rely on it here; absolute is unambiguous).

import path from "node:path";
import fs from "node:fs";
import { PrismaClient } from "@prisma/client";
import { chromium } from "playwright";

const PROFILE = path.resolve(process.cwd(), "_private/apply-profile");

const DB_FILE = process.env.APPLY_WORKER_DB
  ? path.resolve(process.env.APPLY_WORKER_DB)
  : path.resolve(process.cwd(), "jobsyncdb/data/dev.db");

const prisma = new PrismaClient({
  datasources: { db: { url: `file:${DB_FILE.replace(/\\/g, "/")}` } },
});

// --- detectAts: MIRROR of src/lib/apply/ats.ts (host JS, no TS aliases).
// Keep in sync with the app-side source of truth.
function detectAtsProvider(url) {
  let host;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
  if (
    host === "boards.greenhouse.io" ||
    host === "job-boards.greenhouse.io" ||
    host.endsWith(".greenhouse.io")
  ) {
    return "greenhouse";
  }
  if (host === "jobs.lever.co" || host === "jobs.eu.lever.co") return "lever";
  if (host === "jobs.ashbyhq.com") return "ashby";
  return null;
}

// --- Field extraction, injected into every frame (handles Greenhouse's
// embedded application iframe). Plain JSON only.
const COLLECT_FIELDS = `() => {
  const fields = [];
  for (const el of document.querySelectorAll("input, textarea, select")) {
    const type = el.type || el.tagName.toLowerCase();
    if (type === "hidden" || type === "submit" || type === "button" || type === "image") continue;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) continue;
    let label = "";
    try { label = (el.labels && el.labels[0] ? el.labels[0].textContent : "") || ""; } catch {}
    label = label.trim();
    if (!label) label = el.getAttribute("aria-label") || "";
    if (!label) label = el.getAttribute("placeholder") || "";
    if (!label) label = el.getAttribute("name") || "";
    const entry = {
      tag: el.tagName.toLowerCase(),
      type,
      name: el.getAttribute("name") || "",
      id: el.id || "",
      label: String(label).slice(0, 200),
      required: !!(el.required || el.getAttribute("aria-required") === "true"),
      maxLength: el.maxLength > 0 ? el.maxLength : null,
    };
    if (el.tagName === "SELECT") {
      entry.options = Array.from(el.options).slice(0, 100).map((o) => ({
        value: o.value,
        label: (o.textContent || "").trim().slice(0, 200),
        selected: o.selected,
      }));
    }
    if (type === "file") {
      entry.fileInput = true;
      entry.accept = el.getAttribute("accept") || "";
    }
    fields.push(entry);
  }
  return { url: location.href, fieldCount: fields.length, fields };
}`;

const CAPTCHA_CHECK = `() => {
  const sel = [
    'iframe[src*="recaptcha"]',
    'iframe[src*="hcaptcha"]',
    'iframe[src*="turnstile"]',
    ".g-recaptcha[data-sitekey]",
    "[data-hcaptcha-widget-id]",
  ];
  return sel.some((s) => document.querySelector(s) !== null);
}`;

async function main() {
  const applicationId = process.argv[2];
  if (!applicationId) {
    console.error("FAIL: usage: node scripts/apply-worker/run.mjs <applicationId>");
    process.exit(1);
  }

  const application = await prisma.application.findUnique({
    where: { id: applicationId },
  });
  if (!application) {
    console.error(`FAIL: application ${applicationId} not found`);
    process.exit(1);
  }

  const provider = detectAtsProvider(application.sourceUrl);
  console.log("ATS-PROVIDER:", provider ?? "unsupported");
  console.log("SOURCE-URL:", application.sourceUrl);

  fs.mkdirSync(path.dirname(PROFILE), { recursive: true });
  const ctx = await chromium.launchPersistentContext(PROFILE, {
    channel: "msedge",
    headless: false,
    viewport: { width: 1440, height: 900 },
  });
  const page = ctx.pages()[0] ?? (await ctx.newPage());

  let status = "DRAFT";
  let captchaDetected = false;

  try {
    await page.goto(application.sourceUrl, {
      waitUntil: "domcontentloaded",
      timeout: 45_000,
    });
    await page.waitForTimeout(3000); // let embedded apply forms settle

    let captchaFound = false;
    const framesOut = [];
    for (const frame of page.frames()) {
      let captcha = false;
      try {
        captcha = await frame.evaluate(CAPTCHA_CHECK);
      } catch {
        /* cross-origin edge cases: ignore per-frame */
      }
      if (captcha) captchaFound = true;
      let data = null;
      try {
        data = await frame.evaluate(COLLECT_FIELDS);
      } catch {
        /* frame not extractable: skip */
      }
      if (data && data.fieldCount > 0) {
        framesOut.push({
          frameUrl: data.url,
          isMain: frame === page.mainFrame(),
          fields: data.fields,
        });
      }
    }

    captchaDetected = captchaFound;
    const totalFields = framesOut.reduce((n, f) => n + f.fields.length, 0);

    const payload = {
      url: application.sourceUrl,
      atsProvider: provider,
      frames: framesOut,
      totalFields,
      captchaDetected,
      capturedAt: new Date().toISOString(),
    };

    if (!provider) status = "SKIPPED_MANUAL";
    if (captchaDetected) status = "SKIPPED_MANUAL";

    await prisma.$transaction([
      prisma.applicationEvent.create({
        data: {
          applicationId: application.id,
          type: "EXTRACTED",
          payload,
        },
      }),
      prisma.application.update({
        where: { id: application.id },
        data: {
          status,
          atsProvider: application.atsProvider ?? provider,
        },
      }),
    ]);

    if (captchaDetected) {
      await prisma.applicationEvent.create({
        data: {
          applicationId: application.id,
          type: "CAPTCHA_FALLBACK",
          payload: { reason: "captcha detected on posting page", url: application.sourceUrl },
        },
      });
    }

    console.log("FRAMES:", framesOut.length);
    console.log("TOTAL-FIELDS:", totalFields);
    console.log("CAPTCHA:", captchaDetected);
    console.log("STATUS:", status);
    console.log(
      `PASS: extraction stored (application ${application.id}, ${totalFields} fields, status ${status})`,
    );
  } catch (e) {
    await prisma.applicationEvent
      .create({
        data: {
          applicationId: application.id,
          type: "FAILED",
          payload: { message: String(e && e.message ? e.message : e).slice(0, 500) },
        },
      })
      .catch(() => {});
    await prisma.application
      .update({ where: { id: application.id }, data: { status: "FAILED" } })
      .catch(() => {});
    console.error("FAIL:", e && e.message ? e.message : String(e));
    await ctx.close().catch(() => {});
    await prisma.$disconnect();
    process.exit(1);
  }

  await ctx.close();
  await prisma.$disconnect();
  process.exit(0);
}

main().catch((e) => {
  console.error("FAIL:", e && e.message ? e.message : String(e));
  process.exit(1);
});
