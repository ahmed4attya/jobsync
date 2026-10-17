"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toastError, toastSuccess } from "@/lib/toast";
import { prepareApplication } from "@/actions/apply/prepare";
import type {
  ApplyDraftResponse,
  ExtractedField,
  ExtractedFormPayload,
} from "@/models/apply.model";
import {
  ExternalLink,
  FileText,
  ListChecks,
  Loader,
  Send,
  TerminalSquare,
} from "lucide-react";

function StatusBadge({ status }: { status: string }) {
  const color =
    status === "DRAFT"
      ? "bg-slate-100 text-slate-700"
      : status === "READY_REVIEW"
        ? "bg-blue-100 text-blue-700"
        : status === "SUBMITTED"
          ? "bg-emerald-100 text-emerald-700"
          : status === "FAILED"
            ? "bg-red-100 text-red-700"
            : "bg-amber-100 text-amber-800";
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${color}`}>
      {status}
    </span>
  );
}

function FieldsTable({ fields, frameUrl }: { fields: ExtractedField[]; frameUrl: string }) {
  return (
    <div className="border rounded-md">
      <div className="px-3 py-2 bg-muted text-xs text-muted-foreground truncate">
        Form frame: {frameUrl}
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-t bg-muted/50 text-left text-xs text-muted-foreground">
            <th className="px-3 py-2 font-medium">Label</th>
            <th className="px-3 py-2 font-medium">Type</th>
            <th className="px-3 py-2 font-medium">Name / ID</th>
            <th className="px-3 py-2 font-medium">Required</th>
            <th className="px-3 py-2 font-medium">Options</th>
          </tr>
        </thead>
        <tbody>
          {fields.map((f, i) => (
            <tr key={i} className="border-t align-top">
              <td className="px-3 py-2">{f.label || "—"}</td>
              <td className="px-3 py-2">{f.type}</td>
              <td className="px-3 py-2 font-mono text-xs">{f.name || f.id || "—"}</td>
              <td className="px-3 py-2">{f.required ? "Yes" : "No"}</td>
              <td className="px-3 py-2 text-xs">
                {f.options ? `${f.options.length} options` : f.fileInput ? "file" : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ApplyDraftView({ draft }: { draft: ApplyDraftResponse }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [preparing, setPreparing] = useState(false);
  const { application, events, job } = draft;

  const extracted = events.find((e) => e.type === "EXTRACTED");
  const payload = (extracted?.payload as ExtractedFormPayload | null) ?? null;

  const onPrepare = () => {
    setPreparing(true);
    startTransition(async () => {
      const res = await prepareApplication({ jobId: job.id });
      if (res?.success) {
        toastSuccess(res.existing ? "Draft already exists" : "Application draft created");
        router.refresh();
      } else {
        toastError(res?.message ?? "Failed to prepare application");
      }
      setPreparing(false);
    });
  };

  return (
    <div className="col-span-3 flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Send className="h-5 w-5" />
            Prepare Application
          </h1>
          <p className="text-muted-foreground">
            {job.title} · {job.company}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {application ? <StatusBadge status={String(application.status)} /> : null}
          <Button variant="outline" size="sm" onClick={() => router.push(`/dashboard/myjobs/${job.id}`)}>
            Back to job
          </Button>
        </div>
      </div>

      {!application && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-medium">Start a draft</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              Creates a DRAFT application record from the job posting URL. The
              apply worker then extracts the form fields into this draft —
              nothing is ever submitted from here.
            </p>
            <div className="text-sm">
              Source URL:{" "}
              <span className="font-mono text-xs break-all">{job.jobUrl}</span>
            </div>
            <div>
              {job.jobUrl ? (
                <Button onClick={onPrepare} disabled={preparing || pending}>
                  {preparing || pending ? (
                    <Loader className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <FileText className="h-4 w-4 mr-2" />
                  )}
                  Prepare Application
                </Button>
              ) : (
                <p className="text-sm text-muted-foreground">
                  This job has no posting URL — add one from Edit Job first.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {application && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-medium">Draft summary</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground">Status: </span>
                <StatusBadge status={String(application.status)} />
              </div>
              <div>
                <span className="text-muted-foreground">ATS provider: </span>
                {application.atsProvider ?? (
                  <span className="rounded-full border px-2.5 py-0.5 text-xs font-medium">
                    not detected / manual
                  </span>
                )}
              </div>
              <div>
                <span className="text-muted-foreground">Mode: </span>
                {String(application.submissionMode)}
              </div>
              <div>
                <span className="text-muted-foreground">Field coverage: </span>
                {application.fieldCoverage != null
                  ? `${Math.round(application.fieldCoverage * 100)}%`
                  : "pending extraction"}
              </div>
              <div className="md:col-span-2 flex items-center gap-1">
                <span className="text-muted-foreground">Source: </span>
                <a
                  href={application.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline font-mono text-xs break-all inline-flex items-center gap-1"
                >
                  <ExternalLink className="h-3 w-3 shrink-0" />
                  {application.sourceUrl}
                </a>
              </div>
              <div className="md:col-span-2 rounded-md bg-muted/60 border px-3 py-2 font-mono text-xs flex items-start gap-2">
                <TerminalSquare className="h-4 w-4 mt-0.5 shrink-0" />
                <span>
                  Extract fields from the host worker:
                  <br />
                  node scripts/apply-worker/run.mjs {application.id}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-medium flex items-center gap-2">
                <ListChecks className="h-5 w-5" />
                Extracted form fields
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {payload ? (
                payload.frames.map((frame, i) => (
                  <FieldsTable key={i} fields={frame.fields} frameUrl={frame.frameUrl} />
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  No extraction yet. Run the worker command above — fields
                  appear here after the EXTRACTED event lands.
                </p>
              )}
              {payload?.captchaDetected && (
                <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                  A CAPTCHA was detected on the posting page — this draft will
                  stay in the manual flow (CAPTCHA_FALLBACK).
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-medium">Events</CardTitle>
            </CardHeader>
            <CardContent>
              {events.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No events yet — the timeline starts when the worker extracts
                  the form.
                </p>
              ) : (
                <ul className="flex flex-col gap-2 text-sm">
                  {events.map((e) => (
                    <li key={e.id} className="border rounded-md px-3 py-2 flex items-center justify-between gap-2">
                      <span className="font-medium">{String(e.type)}</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(e.createdAt).toLocaleString()}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
