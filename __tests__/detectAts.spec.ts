import { describe, expect, it } from "vitest";
import { detectAts } from "@/lib/apply/ats";

describe("detectAts", () => {
  it("detects greenhouse job URLs", () => {
    expect(detectAts("https://boards.greenhouse.io/acme/jobs/123456")).toEqual({
      provider: "greenhouse",
      supported: true,
    });
  });

  it("detects the job-boards greenhouse variant and subdomains", () => {
    expect(detectAts("https://job-boards.greenhouse.io/acme/jobs/1").provider).toBe(
      "greenhouse",
    );
    expect(detectAts("https://boards.eu.greenhouse.io/acme/jobs/1").provider).toBe(
      "greenhouse",
    );
  });

  it("detects lever URLs including the EU host", () => {
    expect(detectAts("https://jobs.lever.co/acme/abc-123").provider).toBe("lever");
    expect(detectAts("https://jobs.eu.lever.co/acme/abc-123").provider).toBe("lever");
  });

  it("detects ashby URLs", () => {
    expect(detectAts("https://jobs.ashbyhq.com/acme/abc123").provider).toBe("ashby");
  });

  it("reports unsupported for other boards", () => {
    expect(detectAts("https://careers.acme.com/apply/123")).toEqual({
      provider: null,
      supported: false,
    });
    expect(detectAts("https://www.myworkdayjobs.com/acme/job")).toEqual({
      provider: null,
      supported: false,
    });
  });

  it("survives invalid URLs", () => {
    expect(detectAts("not a url")).toEqual({ provider: null, supported: false });
    expect(detectAts("")).toEqual({ provider: null, supported: false });
  });
});
