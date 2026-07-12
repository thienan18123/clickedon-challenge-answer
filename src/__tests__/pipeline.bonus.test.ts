import { describe, it, expect } from "vitest";
import { generate, MAX_REVISIONS } from "../lib/pipeline";

// the existing suite checks the revision loop
// in isolation, but not the boundary where it hands off to the next stage,
// nor whether a failure there still reports the attempts already spent.

describe("Bonus — revision-loop boundary interacting with hand-off", () => {
  it("succeeds when review passes on exactly the last allowed attempt", async () => {
    const res = await generate({
      behavior: "ok",
      advanceToNextStage: async () => {
        /* hand-off succeeds */
      },
      reviewPasses: (attempt) => attempt === MAX_REVISIONS,
    });
    expect(res.status).toBe("ok");
    expect(res.attempts).toBe(MAX_REVISIONS);
  });

  it("reports the attempts already spent on revisions when the subsequent hand-off fails", async () => {
    const res = await generate({
      behavior: "ok",
      advanceToNextStage: async () => {
        throw new Error("next stage unreachable");
      },
      reviewPasses: (attempt) => attempt === 2,
    });
    expect(res.status).toBe("error");
    expect(res.attempts).toBe(2);
  });
});
