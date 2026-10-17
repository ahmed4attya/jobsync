import type {
  ApplicationEventType,
  ApplicationStatus,
  SubmissionMode,
} from "@/lib/apply/constants";

// Shape of one extracted form field, produced by the apply worker and stored
// in the EXTRACTED event payload. Designed to be provider-neutral.
export type ExtractedField = {
  tag: string;
  type: string;
  name: string;
  id: string;
  label: string;
  required: boolean;
  maxLength: number | null;
  options?: { value: string; label: string; selected: boolean }[];
  fileInput?: boolean;
  accept?: string;
};

export type ExtractedFormPayload = {
  url: string;
  atsProvider: string | null;
  frames: {
    frameUrl: string;
    isMain: boolean;
    fields: ExtractedField[];
  }[];
  totalFields: number;
  captchaDetected: boolean;
  capturedAt: string;
};

export type ApplicationEventResponse = {
  id: string;
  applicationId: string;
  type: ApplicationEventType | string;
  payload: unknown;
  createdAt: Date;
};

export type ApplicationResponse = {
  id: string;
  userId: string;
  jobId: string;
  resumeId: string | null;
  coverLetterId: string | null;
  sourceUrl: string;
  atsProvider: string | null;
  status: ApplicationStatus | string;
  submissionMode: SubmissionMode | string;
  fieldCoverage: number | null;
  uniqueApplyKey: string;
  createdAt: Date;
  updatedAt: Date;
};

export type ApplyDraftResponse = {
  application: ApplicationResponse | null;
  events: ApplicationEventResponse[];
  job: {
    id: string;
    title: string;
    company: string;
    jobUrl: string | null;
  };
};
