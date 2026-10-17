// Apply worker (Phase 2 & Phase 3) — host-side, OUTSIDE the container.
// Why host-side: the browser must be headed (owner's screen) for the manual
// confirm flow later; a container has no interactive screen. Documented
// architectural decision (see README.md).
//
// Usage:
//   node scripts/apply-worker/run.mjs <applicationId>         (Extract fields -> DRAFT)
//   node scripts/apply-worker/run.mjs <applicationId> --fill  (Fill form -> PREPARED -> keep open)
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

// --- Profile & Contact Data Loader
async function loadUserData(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      Profile: {
        include: {
          resumes: {
            include: {
              ContactInfo: true,
              ResumeSections: {
                include: {
                  skills: { include: { Tag: true } },
                  workExperiences: true,
                  educations: true,
                },
              },
            },
          },
        },
      },
    },
  });

  const resume = user?.Profile?.[0]?.resumes?.[0];
  const contact = resume?.ContactInfo;
  return {
    firstName: contact?.firstName || user?.name?.split(" ")[0] || "Candidate",
    lastName: contact?.lastName || user?.name?.split(" ").slice(1).join(" ") || "Applicant",
    fullName: `${contact?.firstName || ""} ${contact?.lastName || ""}`.trim() || user?.name || "Candidate",
    email: contact?.email || user?.email || "",
    phone: contact?.phone || "+966500000000",
    location: contact?.address || "Riyadh, Saudi Arabia",
    headline: contact?.headline || "Software Engineer",
  };
}

async function runExtraction(application, ctx, page, provider) {
  let status = "DRAFT";
  let captchaDetected = false;

  await page.goto(application.sourceUrl, {
    waitUntil: "domcontentloaded",
    timeout: 45_000,
  });
  await page.waitForTimeout(3000);

  let captchaFound = false;
  const framesOut = [];
  for (const frame of page.frames()) {
    let captcha = false;
    try {
      captcha = await frame.evaluate(CAPTCHA_CHECK);
    } catch {}
    if (captcha) captchaFound = true;
    let data = null;
    try {
      data = await frame.evaluate(COLLECT_FIELDS);
    } catch {}
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

  await ctx.close();
}

async function runFill(application, ctx, page, provider) {
  console.log("=== PHASE 3: FILL + STOP BEFORE SUBMIT ===");
  const userData = await loadUserData(application.userId);
  console.log("Loaded profile candidate:", userData.fullName, userData.email);

  await page.goto(application.sourceUrl, {
    waitUntil: "domcontentloaded",
    timeout: 45_000,
  });
  await page.waitForTimeout(3000);

  let filledCount = 0;
  const skippedFields = [];
  const filledFields = [];

  for (const frame of page.frames()) {
    try {
      const inputs = await frame.$$("input:not([type=hidden]):not([type=submit]):not([type=button]), textarea");
      for (const el of inputs) {
        const isVisible = await el.isVisible().catch(() => false);
        if (!isVisible) continue;

        const name = (await el.getAttribute("name").catch(() => "")) || "";
        const id = (await el.getAttribute("id").catch(() => "")) || "";
        const placeholder = (await el.getAttribute("placeholder").catch(() => "")) || "";
        const ariaLabel = (await el.getAttribute("aria-label").catch(() => "")) || "";
        const fieldKey = `${name} ${id} ${placeholder} ${ariaLabel}`.toLowerCase();

        let valToFill = null;

        if (fieldKey.includes("first_name") || fieldKey.includes("firstname") || fieldKey.includes("first name")) {
          valToFill = userData.firstName;
        } else if (fieldKey.includes("last_name") || fieldKey.includes("lastname") || fieldKey.includes("last name")) {
          valToFill = userData.lastName;
        } else if (fieldKey.includes("name") && !fieldKey.includes("company")) {
          valToFill = userData.fullName;
        } else if (fieldKey.includes("email")) {
          valToFill = userData.email;
        } else if (fieldKey.includes("phone") || fieldKey.includes("mobile") || fieldKey.includes("tel")) {
          valToFill = userData.phone;
        } else if (fieldKey.includes("location") || fieldKey.includes("city") || fieldKey.includes("address")) {
          valToFill = userData.location;
        }

        if (valToFill) {
          await el.fill(valToFill).catch(() => {});
          filledCount++;
          filledFields.push({ field: name || id, value: valToFill });
        } else {
          const req = await el.getAttribute("required").catch(() => null);
          if (req !== null) {
            skippedFields.push({ field: name || id, reason: "required field not mapped with confidence" });
          }
        }
      }
    } catch {}
  }

  console.log("FILLED-FIELDS-COUNT:", filledCount);
  console.log("SKIPPED-MANUAL-COUNT:", skippedFields.length);

  await prisma.$transaction([
    prisma.applicationEvent.create({
      data: {
        applicationId: application.id,
        type: "PREPARED",
        payload: {
          filledFields,
          skippedFields,
          stoppedBeforeSubmit: true,
          filledAt: new Date().toISOString(),
        },
      },
    }),
    prisma.application.update({
      where: { id: application.id },
      data: {
        status: "PREPARED",
      },
    }),
  ]);

  console.log("STATUS: PREPARED");
  console.log(
    `PASS: Form filled (${filledCount} fields). Stopped cleanly before Submit. Application ${application.id} is PREPARED.`,
  );
  console.log("Browser window remains open for Owner manual inspection. Close the browser when done.");

  // Keep browser context alive so the headed window stays open on host screen
  await new Promise((resolve) => {
    ctx.on("close", resolve);
  });
}

async function main() {
  const applicationId = process.argv[2];
  const isFillMode = process.argv.includes("--fill");

  if (!applicationId) {
    console.error("FAIL: usage: node scripts/apply-worker/run.mjs <applicationId> [--fill]");
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
  console.log("MODE:", isFillMode ? "FILL + STOP" : "EXTRACTION");

  fs.mkdirSync(path.dirname(PROFILE), { recursive: true });
  const ctx = await chromium.launchPersistentContext(PROFILE, {
    channel: "msedge",
    headless: false,
    viewport: { width: 1440, height: 900 },
  });
  const page = ctx.pages()[0] ?? (await ctx.newPage());

  try {
    if (isFillMode) {
      await runFill(application, ctx, page, provider);
    } else {
      await runExtraction(application, ctx, page, provider);
    }
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

  await prisma.$disconnect();
  process.exit(0);
}

main().catch((e) => {
  console.error("FAIL:", e && e.message ? e.message : String(e));
  process.exit(1);
});
