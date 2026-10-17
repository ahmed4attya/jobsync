"use server";

import { requireUser } from "@/actions/shared";
import { ingestWatchSnapshot, IngestStats } from "@/lib/watch/ingest";
import { revalidatePath } from "next/cache";

export async function runWatchIngest(): Promise<{
  success: boolean;
  stats?: IngestStats;
  message?: string;
}> {
  try {
    const user = await requireUser();
    const stats = await ingestWatchSnapshot(user.id);
    revalidatePath("/dashboard/myjobs");
    revalidatePath("/dashboard");
    return { success: true, stats };
  } catch (error: any) {
    return { success: false, message: error?.message || "Failed to ingest watch snapshot" };
  }
}
