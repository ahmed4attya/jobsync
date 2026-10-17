// Regression guard for D-08: the jsdom test global must expose browser
// storage. vitest 4.1.3 + jsdom 30 missed them; the bridge lives in
// vitest.polyfills.ts. If this spec fails again the bridge broke.
import { describe, it, expect } from "vitest";

describe("browser storage globals (D-08 regression)", () => {
  it("exposes localStorage on the test global", () => {
    expect(typeof localStorage).not.toBe("undefined");
    localStorage.clear();
    localStorage.setItem("d08-guard", "1");
    expect(localStorage.getItem("d08-guard")).toBe("1");
    localStorage.clear();
  });

  it("exposes sessionStorage on the test global", () => {
    expect(typeof sessionStorage).not.toBe("undefined");
    sessionStorage.clear();
    sessionStorage.setItem("d08-guard", "1");
    expect(sessionStorage.getItem("d08-guard")).toBe("1");
    sessionStorage.clear();
  });
});
