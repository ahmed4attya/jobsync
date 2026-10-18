const { PrismaClient } = require("@prisma/client");
const { PrismaLibSql } = require("@prisma/adapter-libsql");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

let prisma;
if (process.env.TURSO_DATABASE_URL && process.env.TURSO_AUTH_TOKEN) {
  const adapter = new PrismaLibSql({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
  prisma = new PrismaClient({ adapter });
} else {
  prisma = new PrismaClient();
}

function canonicalize(str) {
  if (!str) return "other";
  return String(str).toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

async function main() {
  const rootDir = process.cwd();
  const snapshotPath = path.join(rootDir, "state", "last_run.json");

  if (!fs.existsSync(snapshotPath)) {
    console.log("[CLI-Ingest] No snapshot file found at:", snapshotPath);
    return;
  }

  const raw = fs.readFileSync(snapshotPath, "utf-8");
  const snapshot = JSON.parse(raw);
  const allJobs = [...(snapshot.ksa || []), ...(snapshot.remote || [])];

  const user = await prisma.user.findFirst();
  if (!user) {
    console.error("[CLI-Ingest] No user found in database.");
    return;
  }

  let defaultStatus = await prisma.jobStatus.findFirst({ where: { value: "new" } });
  if (!defaultStatus) defaultStatus = await prisma.jobStatus.findFirst();
  if (!defaultStatus) {
    console.error("[CLI-Ingest] No JobStatus found in database.");
    return;
  }

  let imported = 0;
  let skipped = 0;

  for (const item of allJobs) {
    const url = item.url ? String(item.url).trim() : null;
    if (!url) continue;

    const existing = await prisma.job.findFirst({
      where: { userId: user.id, jobUrl: url },
    });
    if (existing) {
      skipped++;
      continue;
    }

    const companyRaw = (item.company || "Other").trim();
    const companyVal = canonicalize(companyRaw);
    let company = await prisma.company.findFirst({
      where: { createdBy: user.id, value: companyVal },
    });
    if (!company) {
      company = await prisma.company.create({
        data: { label: companyRaw, value: companyVal, createdBy: user.id },
      });
    }

    const titleRaw = (item.title || "Untitled Role").trim();
    const titleVal = canonicalize(titleRaw);
    let title = await prisma.jobTitle.findFirst({
      where: { createdBy: user.id, value: titleVal },
    });
    if (!title) {
      title = await prisma.jobTitle.create({
        data: { label: titleRaw, value: titleVal, createdBy: user.id },
      });
    }

    let locationId = null;
    if (item.location) {
      const locRaw = String(item.location).trim();
      const locVal = canonicalize(locRaw);
      let loc = await prisma.location.findFirst({
        where: { createdBy: user.id, value: locVal },
      });
      if (!loc) {
        loc = await prisma.location.create({
          data: { label: locRaw, value: locVal, createdBy: user.id },
        });
      }
      locationId = loc.id;
    }

    const srcRaw = item.source ? String(item.source).trim() : "Watch Agent";
    const srcVal = canonicalize(srcRaw);
    let src = await prisma.jobSource.findFirst({
      where: { createdBy: user.id, value: srcVal },
    });
    if (!src) {
      src = await prisma.jobSource.create({
        data: { label: srcRaw, value: srcVal, createdBy: user.id },
      });
    }

    const score = typeof item.score === "number" ? item.score : 0;
    let discoveryStatus = "WATCHED";
    if (score >= 45) discoveryStatus = "MATCHED-STRONG";
    else if (score >= 25) discoveryStatus = "MATCHED";
    else if (score >= 12) discoveryStatus = "NEAR";

    const now = new Date();
    await prisma.job.create({
      data: {
        userId: user.id,
        jobUrl: url,
        description: titleRaw,
        jobType: "Full-time",
        workplaceType: item.location && item.location.toLowerCase().includes("remote") ? "Remote" : "On-site",
        createdAt: now,
        applied: false,
        statusId: defaultStatus.id,
        companyId: company.id,
        jobTitleId: title.id,
        locationId,
        jobSourceId: src.id,
        matchScore: score,
        discoveryStatus,
        discoveredAt: now,
        createdVia: "jobsync-watch-v2",
      },
    });

    imported++;
  }

  console.log(`\n=== INGEST COMPLETED ===`);
  console.log(`Total in snapshot: ${allJobs.length}`);
  console.log(`Imported:          ${imported}`);
  console.log(`Skipped (dedup):   ${skipped}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
