import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { getAllowedOrigins, isOriginAllowed } from "../security.js";

const ORIGINAL_ALLOWED = process.env.HEROBYTE_ALLOWED_ORIGINS;

beforeEach(() => {
  delete process.env.HEROBYTE_ALLOWED_ORIGINS;
});

afterEach(() => {
  if (ORIGINAL_ALLOWED === undefined) {
    delete process.env.HEROBYTE_ALLOWED_ORIGINS;
  } else {
    process.env.HEROBYTE_ALLOWED_ORIGINS = ORIGINAL_ALLOWED;
  }
});

describe("security config", () => {
  it("returns default origins when env not set", () => {
    const origins = getAllowedOrigins();
    expect(origins).toContain("http://localhost:5173");
    expect(origins).toContain("https://herobyte.pages.dev");
  });

  it("parses comma separated env list", () => {
    process.env.HEROBYTE_ALLOWED_ORIGINS = "https://example.com, https://foo.dev";
    expect(getAllowedOrigins()).toEqual(["https://example.com", "https://foo.dev"]);
  });

  it("allows wildcard to disable origin checks", () => {
    process.env.HEROBYTE_ALLOWED_ORIGINS = "https://example.com, *";
    expect(getAllowedOrigins()).toEqual(["*"]);
    expect(isOriginAllowed("https://anywhere.test")).toBe(true);
  });

  it("treats empty origin as allowed", () => {
    expect(isOriginAllowed(undefined)).toBe(true);
    expect(isOriginAllowed(null)).toBe(true);
  });

  it("blocks disallowed origins", () => {
    process.env.HEROBYTE_ALLOWED_ORIGINS = "https://example.com";
    expect(isOriginAllowed("https://blocked.dev")).toBe(false);
    expect(isOriginAllowed("https://example.com")).toBe(true);
  });
});
