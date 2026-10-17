# Apply Worker (Phase 2)

Host-side Node worker for the apply engine. Runs OUTSIDE the Docker container,
on the owner's machine, because the browser must be **headed** (a visible Edge
window on the host screen) for the later manual-confirm flow. This is a
documented architectural decision: containers have no interactive display.

## What it does

Reads one `Application` row, opens the job posting in a persistent Edge profile,
extracts the application form's fields (across all frames — Greenhouse embeds
its apply form in an iframe) and stores them as an `EXTRACTED`
`ApplicationEvent` payload. **It never submits anything** — Phase 2 is
extraction-only by mandate.

## Usage

From the repository root:

```
node scripts/apply-worker/run.mjs <applicationId>
```

The application id is shown on the draft page
(`/dashboard/myjobs/<jobId>/apply`) after "Prepare Application" is clicked.

## Notes

- Browser: system Edge channel only (`channel: "msedge"`, `headless: false`).
  No Chromium download — the bundled download stalls on this machine (M4).
- Profile: `_private/apply-profile` (gitignored) keeps the session persistent
  so logged-in ATS sessions survive between runs.
- DB: resolves `jobsyncdb/data/dev.db` to an absolute path from the repo root.
  Override with `APPLY_WORKER_DB` if needed. The host Prisma CLI resolves the
  .env relative SQLite path against the schema dir — never rely on it here.
- `detectAtsProvider` in `run.mjs` mirrors `src/lib/apply/ats.ts`
  (the app-side source of truth) — keep the two in sync.
- Unsupported ATS URL or a CAPTCHA on the page sets the draft to
  `SKIPPED_MANUAL` (whatever fields were captured are still stored — graceful
  degradation), and a CAPTCHA also logs a `CAPTCHA_FALLBACK` event.
