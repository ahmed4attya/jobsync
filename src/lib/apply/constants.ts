// Apply-engine constants. SQLite has no Prisma enums, so these documented
// strings are the single source of truth for the allowed values (mirrored in
// prisma/schema.prisma comments).

export const APPLICATION_STATUSES = [
  "DRAFT",
  "READY_REVIEW",
  "SUBMITTED",
  "FAILED",
  "SKIPPED_MANUAL",
] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const SUBMISSION_MODES = ["MANUAL_CONFIRM", "AUTO"] as const;
export type SubmissionMode = (typeof SUBMISSION_MODES)[number];

export const APPLICATION_EVENT_TYPES = [
  "EXTRACTED",
  "FILLED",
  "UPLOAD",
  "CONFIRM_WAIT",
  "SUBMITTED",
  "FAILED",
  "CAPTCHA_FALLBACK",
  "DRY_RUN",
] as const;
export type ApplicationEventType = (typeof APPLICATION_EVENT_TYPES)[number];
