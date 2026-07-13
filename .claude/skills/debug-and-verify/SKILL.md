---
name: debug-and-verify
description: Use for any failing test, bug report, or "fix X" request in this repo — not limited to pipeline.ts. Encodes the diagnose-fix-verify workflow validated on this repo's original bugs, generalized for future files and future problems.
---

# Debugging and fixing bugs in this repo

## 1. Reproduce and isolate before touching code

Run `npm test` and read the *actual* assertion failure and stack trace, not just the test name. Identify which function and which branch inside it is responsible before editing anything. If the bug isn't covered by an existing test, write a minimal repro first (a throwaway script or a temporary test) so you can confirm the fix actually closes the gap, not just that it silences the symptom you were told about.

For `generate()` in `src/lib/pipeline.ts` specifically: it has three independent failure surfaces (stream+extract, revision loop, hand-off). Know which one is in play, and check `attempts` in any assertion, not just `status` — a fix that gets one right and the other wrong is still broken. Future bugs may live elsewhere (`src/api/generate.ts`, new modules) — the same isolate-first approach applies regardless of file.

## 2. Diagnose the general failure category, not the specific input that exposed it

Whatever test or fixture surfaced the bug is standing in for a *class* of real-world failure (a dropped stream, a rate limit, a slow reviewer, a network blip) — not a literal string to branch on.

**Anti-pattern already caught in this repo**: special-casing `if (behavior === "truncate-once")` to make one test pass, instead of a retry loop that recovers from *any* failure `mockStream`/`extractJson` can throw; and short-circuiting `reviewPasses` handling to satisfy one assertion's shape instead of a genuinely bounded loop with an honest `attempts` count.

The general rule for any future fix: if it only works because it recognizes a specific enum value, fixture file, call count, or hardcoded attempt number — it's gaming the test, not fixing the bug. Ask "what real-world condition does this input represent?" and fix that.

## 3. Implement, then verify with the full CI sequence locally

Don't stop at `npm test` passing. Run what `.github/workflows/grade.yml` runs, in order, before considering any fix done:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

`noUnusedLocals`/`noUnusedParameters` are on — a half-removed old code path fails typecheck even when tests pass. A fix isn't done until all four are green, for this bug and every other test in the suite (check you didn't regress something else).

## 4. Check boundary conditions the existing tests don't cover

For any fix, ask: does an existing test only prove behavior *stops/starts* correctly, or does it prove the exact boundary (last allowed attempt, first invalid input, empty/max-size input) is *handled* correctly? Does a failure-path test check the full result shape (e.g. a count or reason field), not just a status flag? Off-by-one errors and state-reset regressions hide exactly in these gaps — this applies to any future function, not just the revision loop.

Add a new test file for gaps found this way (e.g. `pipeline.bonus.test.ts` was added for the revision-loop/hand-off boundary). Never edit `src/__tests__/pipeline.test.ts` or `.github/workflows/grade.yml` — both are graded as unmodified, and this restriction should be assumed to extend to any file the project explicitly marks as protected in the future.

## 5. Before pushing: don't assume the remote matches local history

If `git push` is rejected because the remote has a commit local doesn't (common after using "Use this template" on GitHub, which creates a fresh initial commit), don't reflexively force-push. First check whether the content actually diverged:

```bash
git fetch origin
git diff <local-base-commit> origin/main --stat
```

If the diff is empty, it's the same content under a different commit hash — `git rebase origin/main` then push normally. Reserve force-push for cases where remote history genuinely needs overwriting, and confirm with the user first; it's a destructive, hard-to-reverse action.

## 6. Keep CLAUDE.md and this skill current

If a fix reveals architecture, a gotcha, or a workflow step not already documented in `CLAUDE.md` or here, update the relevant doc as part of the fix — that's what keeps future debugging sessions fast instead of re-deriving the same context.
