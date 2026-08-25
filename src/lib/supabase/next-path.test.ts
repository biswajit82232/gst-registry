import { describe, expect, it } from "vitest";
import { safeNextPath } from "./next-path";

describe("safeNextPath", () => {
  it("allows same-origin paths", () => {
    expect(safeNextPath("/")).toBe("/");
    expect(safeNextPath("/purchases/new")).toBe("/purchases/new");
  });

  it("rejects open redirects", () => {
    expect(safeNextPath("@evil.com")).toBe("/");
    expect(safeNextPath("//evil.com")).toBe("/");
    expect(safeNextPath("https://evil.com")).toBe("/");
    expect(safeNextPath("/\\evil.com")).toBe("/");
    expect(safeNextPath("/foo/../bar")).toBe("/");
    expect(safeNextPath(null)).toBe("/");
  });
});
