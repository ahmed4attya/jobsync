"use server";
import prisma from "@/lib/db";
import { handleError } from "@/lib/utils";
import { requireUser } from "@/actions/shared";
import { detectAts } from "@/lib/apply/ats";
import type {
  ApplicationEventResponse,
  ApplicationResponse,
  ApplyDraftResponse,
} from "@/models/apply.model";
import { z } from "zod";

const PrepareSchema = z.object({ jobId: z.string().min(1) });

// Canonical dedup key: user + normalized source URL, so re-preparing the same
// posting is idempotent and never creates a second draft.
function uniqueApplyKeyFor(userId: string, sourceUrl: string): string {
  let normalized = sourceUrl.trim();
  try {
    const u = new URL(normalized);
    u.hash = "";
    normalized = u.toString().replace(/\/$/, "");
  } catch {
    // leave as-is; a non-URL source is still a usable key
  }
  return `${userId}:${normalized.toLowerCase()}`;
}

export const prepareApplication = async (
  data: z.infer<typeof PrepareSchema>,
): Promise<any | undefined> => {
  try {
    const user = await requireUser();
    const { jobId } = PrepareSchema.parse(data);

    const job = await prisma.job.findFirst({
      where: { id: jobId, userId: user.id },
      select: { id: true, jobUrl: true },
    });
    if (!job) {
      throw new Error("Job not found");
    }
    if (!job.jobUrl) {
      return {
        success: false,
        message: "This job has no URL to prepare an application from.",
      };
    }

    const detection = detectAts(job.jobUrl);
    const uniqueApplyKey = uniqueApplyKeyFor(user.id, job.jobUrl);

    const existing = await prisma.application.findUnique({ where: { uniqueApplyKey } });
    if (existing) {
      return { success: true, data: existing, existing: true };
    }

    const application = await prisma.application.create({
      data: {
        userId: user.id,
        jobId: job.id,
        sourceUrl: job.jobUrl,
        atsProvider: detection.provider,
        status: "DRAFT",
        submissionMode: "MANUAL_CONFIRM",
        uniqueApplyKey,
      },
    });

    return { success: true, data: application };
  } catch (error) {
    const msg = "Failed to prepare application. ";
    return handleError(error, msg);
  }
};

export const getApplyDraft = async (
  jobId: string,
): Promise<any | undefined> => {
  try {
    const user = await requireUser();

    const job = await prisma.job.findFirst({
      where: { id: jobId, userId: user.id },
      select: { id: true, jobUrl: true, JobTitle: { select: { label: true } }, Company: { select: { label: true } } },
    });
    if (!job) {
      throw new Error("Job not found");
    }

    const application = await prisma.application.findFirst({
      where: { jobId: job.id, userId: user.id },
      orderBy: { createdAt: "desc" },
    });

    const events: ApplicationEventResponse[] = application
      ? await prisma.applicationEvent.findMany({
          where: { applicationId: application.id },
          orderBy: { createdAt: "desc" },
        })
      : [];

    const data: ApplyDraftResponse = {
      application: (application as ApplicationResponse | null) ?? null,
      events,
      job: {
        id: job.id,
        title: job.JobTitle?.label ?? "",
        company: job.Company?.label ?? "",
        jobUrl: job.jobUrl,
      },
    };

    return { success: true, data };
  } catch (error) {
    const msg = "Failed to load application draft. ";
    return handleError(error, msg);
  }
};
