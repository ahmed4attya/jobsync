"use server";

import prisma from "@/lib/db";
import { requireUser } from "@/actions/shared";

export async function markApplicationSubmittedManually({
  applicationId,
}: {
  applicationId: string;
}) {
  try {
    const user = await requireUser();
    if (!user) {
      return { success: false, message: "Unauthorized" };
    }

    const application = await prisma.application.findUnique({
      where: { id: applicationId },
      include: { Job: true },
    });

    if (!application || application.userId !== user.id) {
      return { success: false, message: "Application not found" };
    }

    const appliedStatus =
      (await prisma.jobStatus.findFirst({
        where: { value: "applied" },
      })) ||
      (await prisma.jobStatus.findFirst({
        where: { label: { contains: "Applied" } },
      }));

    await prisma.$transaction([
      prisma.application.update({
        where: { id: applicationId },
        data: {
          status: "SUBMITTED",
        },
      }),
      prisma.applicationEvent.create({
        data: {
          applicationId,
          type: "SUBMITTED",
          payload: {
            mode: "MANUAL_CONFIRMED",
            submittedAt: new Date().toISOString(),
          },
        },
      }),
      prisma.job.update({
        where: { id: application.jobId },
        data: {
          applied: true,
          appliedDate: new Date(),
          statusId: appliedStatus ? appliedStatus.id : application.Job.statusId,
        },
      }),
    ]);

    return { success: true };
  } catch (error) {
    console.error("markApplicationSubmittedManually error:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Failed to record manual submission",
    };
  }
}
