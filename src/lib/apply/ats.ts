import { APP_CONSTANTS } from "@/lib/constants";

// ATS detection for the apply engine. Hosts come from the live constants in
// src/lib/constants.ts (the same sources the scrapers use) — never from
// memory. The worker at scripts/apply-worker/run.mjs mirrors this file for the
// host-side Node runtime; keep the two in sync.

export type SupportedAtsProvider = "greenhouse" | "lever" | "ashby";
export type AtsDetectionResult = {
  provider: SupportedAtsProvider | null;
  supported: boolean;
};

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

export function detectAts(url: string): AtsDetectionResult {
  const host = hostOf(url);
  if (!host) return { provider: null, supported: false };

  const greenhouseHost = hostOf(APP_CONSTANTS.GREENHOUSE_BOARD_URL) ?? "";
  const leverHost = hostOf(APP_CONSTANTS.LEVER_JOB_URL) ?? "";
  const leverEuHost = hostOf(APP_CONSTANTS.LEVER_EU_JOB_URL) ?? "";
  const ashbyHost = hostOf(APP_CONSTANTS.ASHBY_JOB_URL) ?? "";

  // Greenhouse public postings live on boards.greenhouse.io; some companies
  // use the job-boards.greenhouse.io variant or a *.greenhouse.io subdomain.
  if (
    host === greenhouseHost ||
    host === "job-boards.greenhouse.io" ||
    host.endsWith(".greenhouse.io")
  ) {
    return { provider: "greenhouse", supported: true };
  }
  if (host === leverHost || host === leverEuHost) {
    return { provider: "lever", supported: true };
  }
  if (host === ashbyHost) {
    return { provider: "ashby", supported: true };
  }
  return { provider: null, supported: false };
}
