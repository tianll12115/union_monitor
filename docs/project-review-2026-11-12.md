# Project review — 2026-11-12

Reviewed the current Python collectors, metrics, storage, unified release modules,
browser application, developer scripts, workflows, configuration, documentation,
and their regression tests. Historical audit evidence was inspected for references
and retained; archived screenshots and frozen evidence are not current runtime code.
This is a source and regression review, not a claim that every possible defect has
been found or that live upstream services and production deployment were validated.

## Fixed

| Problem | Change and regression evidence |
| --- | --- |
| A remote development snapshot path could escape `web/data` on Windows using backslashes or a drive prefix. Offline copying also accepted parent traversal. | `scripts/devdata.py` rejects unsafe paths consistently before selecting copy targets; `tests/test_devdata.py` covers Windows, POSIX, malformed, and offline paths. |
| Git C-quoted Unicode names and space-containing names were silently omitted from changed-line coverage enforcement. | `scripts/verify_changed_coverage.py` decodes Git paths and fails closed on malformed quoting; `tests/test_changed_coverage.py` exercises real Git output and special characters. |
| Invalid Jenkins queue components (booleans, negative or nonfinite values) became plausible durations. | `metrics.py` preserves an unknown queue/total; `tests/test_metrics.py` exercises each component and valid zero. |
| A single-repository refresh could retry a different repository's previously recorded HTTP 429 failure. | `collect.py` limits cooldown retries to the selected scope; `tests/test_collection_multi.py` checks calls and unchanged unselected status. |
| Earlier collection time consumed a later project's timeout budget. | `monitor/orchestrate.py` starts the deadline per project; a virtual-clock regression covers a 100-minute UBS run followed by a valid 30-minute Triton run. |
| Public verification retried permanent HTTP errors such as 403/404 as transient failures. | `monitor/public_verify.py` classifies HTTP errors; tests retain retries for 408, 429, 503 and network failures. |
| Cold restoration and rollback could return or deploy corrupted archive bytes before checking integrity. | `monitor/baseline.py` validates the exact loaded bytes; `monitor/rollback.py` uses verified restoration. Tests prove corrupted bytes never reach deployment callbacks. |
| A representative batch could override an explicitly selected detail batch; expired batch links still expanded a different batch. | `web/app.js` separates representative labeling from expansion. Node and Chromium regressions cover selection after the representative and expired identities. |
| Duplicate UBS `q` parameters were discarded while the notice claimed the first value was retained. | `web/app.js` now retains the first search value; a runtime regression checks the input and notice. |
| The local check command executed every Node UT twice. | `scripts/run_checks.py` retains the full c8-instrumented run and removes the redundant preliminary run. The command regression requires all test files and exactly one execution. |

Every fix has a regression test demonstrated to fail before its implementation.

## Review decisions

1. **Online development data can retain stale release metadata.**
   `scripts/devdata.py:run_online` refreshes snapshots but does not refresh
   `web/data/release.json`; offline mode does. An offline-to-online switch can
   leave fixture release identity attached to current data. Decide whether online
   bootstrap should require a release manifest, remove stale metadata, or fetch a
   complete version-bound bundle. Legacy sources may not publish that manifest.

2. **Retire unused UI modules together with their historical contracts.**
   `web/workbench.js`, `web/workbench-view.js`, and `web/shell-init.js` are not loaded
   by `web/index.html`, but several tests still import them. `renderQuality`,
   `renderTritonRecords`, and `tritonRecordList` in `web/app.js` have no reachable
   current route; the latter renderer is still asserted by
   `scripts/verify_interactions.py`. Confirm whether the planned workbench will
   return before deleting its code and retiring the corresponding tests.

3. **Consolidate duplicate test execution without reducing coverage.**
   The duplicate local Node run is fixed. `scripts/submit_pr.py` still runs the
   whole gate, then an installed pre-push hook runs
   it again. CI also repeats Python tests across jobs. A single instrumented local
   Node run is now used locally; submission/hook consolidation needs a
   reliable binding between tested SHA, clean worktree, and pushed SHA. Preserve
   the required full Python, Node, and browser suites.

4. **Clarify coverage policy for executable audit/documentation scripts.**
   `scripts/verify_changed_coverage.py` excludes all `docs/` and `audit/` paths,
   including `.py`/`.js` files. AGENTS.md states a general changed-code coverage
   requirement. Decide which frozen historical utilities are exempt and which
   maintained tools should be measured; use explicit exceptions rather than
   accidentally exempting future tools by location.

5. **Separate PR push remote from PR base repository.**
   `scripts/submit_pr.py --remote fork` derives `gh --repo` from that remote, so it
   targets the fork's main rather than independently selecting upstream. Current
   same-repository feature branches work; a genuine cross-repository fork flow
   needs separate destination arguments and contract tests.

6. **Keep target architecture distinct from production guarantees.**
   `docs/operations.md` correctly states that production uses two legacy workflows,
   replaces pending runs according to the shared concurrency group, and has no
   automatic post-deployment rollback. `monitor/release_lock.py` and related
   unified release helpers model stronger behavior but do not provide a deployed
   cross-process lock or atomic filesystem compare-and-swap. Production migration
   needs integration and failure-injection validation before advertising those
   guarantees. The timeout check in `run_round` also detects overruns after a
   synchronous collector returns; it cannot interrupt a hung collector itself.

7. **Audit older Triton templates before re-enabling them.**
   Some legacy list templates build source links directly, whereas the active
   hover/detail path has explicit safe-link handling. Exploitability was not
   established in this review. Confirm reachability and upstream URL guarantees,
   or retire those templates with the obsolete routes.

8. **Retain frozen audit evidence until its replacement is agreed.**
   Hundreds of files under `audit/` and archived requirement evidence remain
   referenced by acceptance and mutation tests. Moving or deleting them requires
   an evidence-retention decision and a replacement for those contracts; age alone
   is insufficient evidence that they are no longer needed.

## Validation

- `python -B scripts/run_checks.py --browser`: passed on Windows, Python 3.14 /
  Node 24. Full Python discovery ran 1,069 tests (10 existing platform/artifact
  skips), all 363 Node tests passed, all 76 Chromium tests passed, and the required
  journey verifier passed 17/17.
- Changed executable-line coverage relative to the merge base with `main`:
  **100% (38/38)**, combining Python, Node, and browser LCOV.
- WSL Ubuntu / Python 3.12.3 / Node 24: full Python discovery passed, 1,069
  tests with one existing skip for absent live Triton collection artifacts. This
  run includes the POSIX cache-chain and interaction tests skipped on Windows.
- `git diff --check`: passed. Independent review found no actionable regressions.

Local machine-readable coverage is written to `test-results/changed-coverage.json`;
full logs are under `.tmp/project-audit-*`. No branch protection, workflow gate,
or test skip rule was weakened. No production collection, deployment, or GitHub CI
run is claimed by these local results.
