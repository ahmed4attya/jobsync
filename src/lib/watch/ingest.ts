import fs from "fs";
import path from "path";
import prisma from "@/lib/db";
import { canonicalizeEntityValue } from "@/lib/jobs/canonicalize";
import { firstStageCreate } from "@/lib/jobs/createJobRecord";

export interface IngestStats {
  totalInSnapshot: number;
  imported: number;
  skippedDuplicate: number;
  errors: number;
}

export async function ingestWatchSnapshot(userId: string): Promise<IngestStats> {
  const rootDir = process.cwd();
  const snapshotPath = path.join(rootDir, "state", "last_run.json");

  const stats: IngestStats = {
    totalInSnapshot: 0,
    imported: 0,
    skippedDuplicate: 0,
    errors: 0,
  };

  if (!fs.existsSync(snapshotPath)) {
    return stats;
  }

  let snapshotRaw: string;
  try {
    snapshotRaw = fs.readFileSync(snapshotPath, "utf-8");
  } catch (err) {
    console.error("[Watch-Ingest] Failed to read snapshot file:", err);
    return stats;
  }

  let snapshot: { ksa?: any[]; remote?: any[] };
  try {
    snapshot = JSON.parse(snapshotRaw);
  } catch (err) {
    console.error("[Watch-Ingest] Failed to parse snapshot JSON:", err);
    return stats;
  }

  const allJobs = [...(snapshot.ksa || []), ...(snapshot.remote || [])];
  stats.totalInSnapshot = allJobs.length;

  // Resolve or create a default Status (e.g. "new" or "draft")
  let defaultStatus = await prisma.jobStatus.findFirst({
    where: { value: "new" },
  });
  if (!defaultStatus) {
    defaultStatus = await prisma.jobStatus.findFirst();
  }
  if (!defaultStatus) {
    console.error("[Watch-Ingest] No job status found in database.");
    return stats;
  }

  for (const item of allJobs) {
    try {
      const url = item.url ? String(item.url).trim() : null;
      if (!url) {
        continue;
      }

      // 1. Duplicate check (Idempotent by url + userId)
      const existing = await prisma.job.findFirst({
        where: {
          userId,
          jobUrl: url,
        },
      });

      if (existing) {
        stats.skippedDuplicate++;
        continue;
      }

      // 2. Resolve Company
      const companyRaw = (item.company || "Other").trim();
      const companyVal = canonicalizeEntityValue(companyRaw);
      let company = await prisma.company.findFirst({
        where: { createdBy: userId, value: companyVal },
      });
      if (!company) {
        company = await prisma.company.create({
          data: {
            label: companyRaw,
            value: companyVal,
            createdBy: userId,
          },
        });
      }

      // 3. Resolve JobTitle
      const titleRaw = (item.title || "Untitled Role").trim();
      const titleVal = canonicalizeEntityValue(titleRaw);
      let title = await prisma.jobTitle.findFirst({
        where: { createdBy: userId, value: titleVal },
      });
      if (!title) {
        title = await prisma.jobTitle.create({
          data: {
            label: titleRaw,
            value: titleVal,
            createdBy: userId,
          },
        });
      }

      // 4. Resolve Location
      let locationId: string | null = null;
      if (item.location) {
        const locRaw = String(item.location).trim();
        const locVal = canonicalizeEntityValue(locRaw);
        let loc = await prisma.location.findFirst({
          where: { createdBy: userId, value: locVal },
        });
        if (!loc) {
          loc = await prisma.location.create({
            data: {
              label: locRaw,
              value: locVal,
              createdBy: userId,
            },
          });
        }
        locationId = loc.id;
      }

      // 5. Resolve JobSource
      let jobSourceId: string | null = null;
      const srcRaw = item.source ? String(item.source).trim() : "Watch Agent";
      const srcVal = canonicalizeEntityValue(srcRaw);
      let src = await prisma.jobSource.findFirst({
        where: { createdBy: userId, value: srcVal },
      });
      if (!src) {
        src = await prisma.jobSource.create({
          data: {
            label: srcRaw,
            value: srcVal,
            createdBy: userId,
          },
        });
      }
      jobSourceId = src.id;

      // 6. Map Score to Discovery Status (Section C1 specification)
      const score = typeof item.score === "number" ? item.score : 0;
      let discoveryStatus = "WATCHED";
      if (score >= 45) {
        discoveryStatus = "MATCHED-STRONG";
      } else if (score >= 25) {
        discoveryStatus = "MATCHED";
      } else if (score >= 12) {
        discoveryStatus = "NEAR";
      }

      const now = new Date();
      const stages = await firstStageCreate(defaultStatus.id, userId, now);

      // 7. Create Job Record
      await prisma.job.create({
        data: {
          userId,
          jobUrl: url,
          description: titleRaw,
          jobType: "Full-time",
          workplaceType: item.location?.toLowerCase().includes("remote") ? "Remote" : "On-site",
          createdAt: now,
          applied: false,
          statusId: defaultStatus.id,
          companyId: company.id,
          jobTitleId: title.id,
          locationId,
          jobSourceId,
          matchScore: score,
          discoveryStatus,
          discoveredAt: now,
          createdVia: "jobsync-watch-v2",
          stages,
        },
      });

      stats.imported++;
    } catch (err) {
      console.error("[Watch-Ingest] Error importing item:", err);
      stats.errors++;
    }
  }

  return stats;
}
