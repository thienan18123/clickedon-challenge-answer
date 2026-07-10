import { extractJson } from "./extract-json";
import { mockStream, type MockBehavior, type MockState } from "./anthropic-mock";

export interface GenerateInput {
  /** Drives the mock streaming client (see anthropic-mock.ts). */
  behavior: MockBehavior;
  /** Hands the finished draft to the next pipeline stage. May reject. */
  advanceToNextStage: () => Promise<void>;
  /** Returns true once the draft passes review. Scripted by callers/tests. */
  reviewPasses: (attempt: number) => boolean;
}

export interface GenerateResult {
  status: "ok" | "error";
  attempts: number;
}

const MAX_REVISIONS = 3;
const MAX_MODEL_RETRIES = 3;

/**
 * Streams a draft and extracts its JSON, retrying on transient errors (e.g.
 * rate limits) or a truncated stream — both of which succeed on a later call.
 */
async function fetchDraft(
  behavior: MockBehavior,
  state: MockState,
): Promise<unknown> {
  let lastError: unknown;
  for (let i = 0; i < MAX_MODEL_RETRIES; i++) {
    try {
      const text = await mockStream(behavior, state);
      return extractJson(text);
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}

/**
 * Runs one content-generation pass: stream a draft, extract it, revise until it
 * passes review, then hand off to the next stage.
 *
 * This is a faithful (stripped-down) reproduction of the real pipeline — and it
 * ships with three real bugs from that pipeline. Your job is to fix them so the
 * test suite passes. See the README for the symptoms. (Do not edit the tests.)
 */
export async function generate(input: GenerateInput): Promise<GenerateResult> {
  const state: MockState = { calls: 0 };

  try {
    await fetchDraft(input.behavior, state);
  } catch {
    return { status: "error", attempts: 0 };
  }

  // Revise until the draft passes review, bounded by MAX_REVISIONS.
  let attempt = 0;
  let passed = input.reviewPasses(attempt);
  while (!passed && attempt < MAX_REVISIONS) {
    attempt += 1;
    passed = input.reviewPasses(attempt);
  }
  if (!passed) {
    return { status: "error", attempts: attempt };
  }

  // Hand off to the next stage; a failed hand-off must surface as an error.
  try {
    await input.advanceToNextStage();
  } catch {
    return { status: "error", attempts: attempt };
  }

  return { status: "ok", attempts: attempt };
}

export { MAX_REVISIONS };
