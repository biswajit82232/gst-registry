import { describe, expect, it } from "vitest";
import { planIdReconcile } from "./sync";

describe("planIdReconcile", () => {
  it("does nothing when the remote id pull was incomplete", () => {
    const local = [
      { id: "a", dirty: 0, deleted: 0 },
      { id: "b", dirty: 1, deleted: 0 },
    ];
    const result = planIdReconcile(local, [], { remoteComplete: false, seenIds: ["a"] });
    expect(result.dropIds).toEqual([]);
    expect(result.nextSeen).toEqual(["a"]);
  });

  it("drops clean local rows missing remotely when the pull completed", () => {
    const local = [
      { id: "keep", dirty: 0, deleted: 0 },
      { id: "gone", dirty: 0, deleted: 0 },
    ];
    const result = planIdReconcile(local, ["keep"], { remoteComplete: true, seenIds: ["keep", "gone"] });
    expect(result.dropIds).toEqual(["gone"]);
    expect(result.nextSeen).toEqual(["keep"]);
  });

  it("allows an empty remote set to clear previously seen rows", () => {
    const local = [{ id: "old", dirty: 0, deleted: 0 }];
    const result = planIdReconcile(local, [], { remoteComplete: true, seenIds: ["old"] });
    expect(result.dropIds).toEqual(["old"]);
    expect(result.nextSeen).toEqual([]);
  });

  it("keeps unsynced local creates (dirty, never seen)", () => {
    const local = [{ id: "new-local", dirty: 1, deleted: 0 }];
    const result = planIdReconcile(local, ["remote"], {
      remoteComplete: true,
      seenIds: ["remote"],
    });
    expect(result.dropIds).toEqual([]);
  });

  it("drops a dirty edit of a previously seen id (no resurrection)", () => {
    const local = [{ id: "edited", dirty: 1, deleted: 0 }];
    const result = planIdReconcile(local, [], {
      remoteComplete: true,
      seenIds: ["edited"],
    });
    expect(result.dropIds).toEqual(["edited"]);
  });

  it("drops local tombstones that are already gone remotely", () => {
    const local = [{ id: "dead", dirty: 1, deleted: 1 }];
    const result = planIdReconcile(local, ["other"], {
      remoteComplete: true,
      seenIds: ["dead", "other"],
    });
    expect(result.dropIds).toEqual(["dead"]);
  });
});
