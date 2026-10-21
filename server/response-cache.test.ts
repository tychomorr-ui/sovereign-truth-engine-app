import { describe, expect, it } from "vitest";
import { isCacheFresh, RESPONSE_CACHE_TTL_MS } from "./response-cache";

describe("response cache TTL", () => {
  const now = Date.parse("2026-10-21T00:00:00.000Z");

  it("keeps entries fresh through five minutes", () => {
    expect(isCacheFresh(new Date(now - RESPONSE_CACHE_TTL_MS), now)).toBe(true);
    expect(isCacheFresh(new Date(now - RESPONSE_CACHE_TTL_MS - 1), now)).toBe(false);
  });

  it("does not replay entries dated in the future", () => {
    expect(isCacheFresh(new Date(now + 1), now)).toBe(false);
  });
});
