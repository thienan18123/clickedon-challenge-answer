# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm ci               # install (CI uses this, not `npm install`)
npm test             # vitest run — all tests in src/**/*.test.ts
npm run typecheck    # tsc --noEmit
npm run lint         # eslint src
npm run build        # tsc -p tsconfig.json -> dist/
```

Run a single test file: `npx vitest run src/__tests__/pipeline.test.ts`
Run a single test by name: `npx vitest run -t "returns status 'error' when advanceToNextStage rejects"`

The `grade` GitHub Actions workflow (`.github/workflows/grade.yml`) runs typecheck → lint → test → build in that order on every push to `main`/`master`. All four must pass.

## Architecture

This is a stripped-down reproduction of ClickedOn's content-generation pipeline, built as a hiring challenge (see README.md). The graded logic lives entirely in `src/lib/pipeline.ts`; everything else is scaffolding around it.

**`generate()` in `src/lib/pipeline.ts`** is the single entry point. One call runs one content-generation pass through three sequential stages, each with its own failure mode:

1. **Stream + extract** — calls `mockStream()` to get model output, then `extractJson()` (`src/lib/extract-json.ts`) to pull a fenced ` ```json ` block out of it. A truncated stream (missing closing fence) or a transient error from `mockStream` both throw here.
2. **Revise until review passes** — calls `input.reviewPasses(attempt)` in a loop, incrementing `attempt` each time it returns false. This loop must be bounded (`MAX_REVISIONS`); an unbounded loop or one with no failure path is a bug.
3. **Hand off** — calls `input.advanceToNextStage()`, which represents handing the finished draft to the next stage of the real pipeline (SEO, social, assembly, ...). This is caller-supplied and may reject.

`GenerateResult { status: "ok" | "error", attempts: number }` is the only signal callers get — there's no separate error-reason field, so `attempts` doing double duty as "how many revisions happened" must stay accurate even when the failure happens in a later stage (e.g. a hand-off failure after revisions already succeeded).

**Determinism via dependency injection**: nothing in `pipeline.ts` talks to a real network. `input.behavior: MockBehavior` drives `src/lib/anthropic-mock.ts` (`"ok" | "truncate-once" | "transient-429-twice"`, keyed off a per-run `MockState.calls` counter), and `input.reviewPasses` / `input.advanceToNextStage` are plain functions supplied by the caller — tests script them directly, `src/api/generate.ts` wires them to real-ish behavior for the (illustrative, not graded) `POST /api/content/generate` handler.

**Fixtures**: `src/fixtures/deck.full.json` and `deck.truncated.json` hold the literal model-response text (`{ text: string }`) that `mockStream` returns for the "ok" vs. truncated cases.

## Constraints specific to this repo

- `src/__tests__/pipeline.test.ts` and `.github/workflows/grade.yml` are graded as unmodified — do not edit either. New test files (e.g. `pipeline.bonus.test.ts`) are fine and expected (see README's bonus-test ask).
- Fixes belong in `src/lib/pipeline.ts` (and, if truly needed, `extract-json.ts`/`anthropic-mock.ts`) — not in the test file, not by special-casing a specific `MockBehavior` value or fixture instead of handling the general failure category it represents.
- `noUnusedLocals`/`noUnusedParameters` are enabled in `tsconfig.json` — dead code from a half-applied fix will fail typecheck, not just lint.
