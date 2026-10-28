# Triton E2E and PR history implementation plan

> Execute in this session with test-driven development and a final independent review.

Goal: independently attributable Integration Tests run/attempt E2E, true-coordinate charts, and accessible same-PR submission history.

Architecture: retain the source workflow batches for NPU/source coverage; add a versioned, fail-closed Integration Tests measurement rebuilt from each run/attempt's jobs. Never infer cross-workflow gate events from timestamps. Rebuild historical snapshots through the same source boundary before display.

Spec: user approved Integration Tests E2E and true-coordinate scatter plus PR history on 2026-10-28; final contract in docs/triton-e2e-v2.md.

Constraints: full Python, Node and browser suites; changed executable lines >80% coverage; branch PR and current-head GitHub Actions quality gate; preserve main protections.

Review focus: stale snapshots, same-SHA independent runs, rerun starts, missing job completions, overlapping points and unknown PR identities.

1. Add failing Python tests for source-based Integration Tests measurement, unrelated auxiliary runs, missing jobs, reruns and tamper rejection. Implement versioned per-run batching and independent quality validation, update contracts that encoded the superseded PR+SHA duration. Verify all Python tests.
2. Add failing Node/browser tests for legacy migration, true coordinates, PR history selection and overlap access. Implement a pure source adapter and history helper, render actual coordinates, simplify tooltip, provide history and overlap choices in unified detail; update UI copy and exports. Verify complete Node/browser suites.
3. Run complete coverage collection and changed-line gate against main; independently review, fix substantive issues with regression tests, commit changes and push PR. Wait for all required current-head Actions checks and report the PR/result.

Ledger: baseline Node 342/342 pass. Baseline Python 996 executed, 7 cache-chain failures from Windows resolving bash to WSL (shim interpreter/path errors), 1 platform skip; repair execution environment without skipping tests before final verification. Working in managed worktree codex/triton-e2e-history.

Final local verification: full Python 1008 tests passed (one existing platform skip) under Linux with native shell; Node 347 passed with none skipped; browser 64 passed including all 17 required journeys. Changed executable-line coverage against main: 147/151 = 97.35%. Independent review findings on auxiliary-axis pollution, explicit attempt links and history numbering were fixed with regression tests. Remaining four uncovered lines are defensive malformed-source/error branches in independent reconciliation.
