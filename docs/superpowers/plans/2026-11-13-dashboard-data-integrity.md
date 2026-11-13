# Dashboard data integrity implementation plan

> For agentic workers: use superpowers:executing-plans; discovery and UBS investigations may run independently with exclusive file ownership.

**Goal:** Every displayed metric reconciles to retained source identities; scope changes, incomplete discovery and invalid measurements cannot silently produce trusted numbers.
**Architecture:** Keep workflow/attempt records independent. Register both proven Integration Tests identities, detect unknown replacements, reconcile source coverage independently, and show sample accounting beside metrics. Repair independently reproduced UBS defects without redefining its metrics.
**Tech Stack:** Python unittest/coverage, dependency-free JavaScript, Node tests, Playwright.
**Spec:** User directive 2026-11-13: accuracy and no silent omissions take priority; AGENTS.md governs UT, >80% changed-line coverage, commit and protected PR merge.

## Global constraints
- Keep raw evidence, unknown PRs and invalid timestamps; never invent zero or merge independent runs.
- Include old ci.yml/241783889 and ascend-ci.yml/348219361 only as validated pairs; fail closed on an unclassified Integration Tests replacement.
- Exhaustive means the declared PR-event population available through GitHub, not other events or deleted/expired evidence. Expose collection boundaries and unavailable evidence.
- Full Python, Node and browser suites; coverage >80%; current-head Dashboard quality gate green before PR merge; no protection changes.

## Review focus
- Unknown workflow IDs and mismatched path pairs cannot silently disappear from E2E.
- Reruns created long ago, historical as-of, and second-resolution split boundaries cannot be lost.
- A removed in-window record cannot be relabelled out-of-window by the coverage ledger.
- Missing, invalid, cancelled and auxiliary records must reconcile separately from valid completed samples.
- Source step/job timestamp contradictions cannot be presented as exact reliable E2E.

## Task 1: Registered CI identities and fail-closed scope drift
Files: triton/run_e2e.py, triton/quality.py, tests/test_triton_run_e2e.py, docs/triton-e2e-v2.md.
- [x] Add regression tests for new CI qualified E2E and source/quality reconciliation, wrong pair exclusion, unknown same-name CI publication failure.
- [x] Run tests and observe failures; add validated ID/path pairs and independent validator checks.
- [x] Retain independent attempts and PR identity qualification; verify mutations rejected.

## Task 2: Discovery and source accounting
Files: triton/discovery.py if needed, triton/dashboard.py discovery/collect/ledger regions, tests/test_triton_discovery_integrity.py, relevant existing collector tests.
- [x] Reproduce integer-second split hole, historical attempt prefilter omission and forged ledger exclusion; fix each after RED.
- [x] Remove arbitrary 14-day discovery cutoff using complete retained run enumeration if API supports it; retain explicit source limits and fail closed on pagination/coverage mismatch.
- [x] Verify source-based exclusion times and prevent unknown identities/duplicate outputs from balancing the ledger.

## Task 3: Honest frontend sample accounting and timestamp quality
Files: web/triton-core.js, web/triton-view.js, triton/dashboard.py _job/build_payload regions, tests/triton_integrity.test.cjs, tests/test_triton_run_e2e.py, tests/browser/triton-integrity.spec.cjs.
- [x] Write RED tests for eligible/excluded/unknown/missing accounting and new-CI browser display.
- [x] Show denominators and exclusion reasons for each metric, distinguish workflow attempts from PR submissions and NPU population from E2E.
- [x] Preserve and flag source job/step timeline conflicts; quarantine contradictory E2E evidence with tests.

## Task 4: UBS demonstrated defects, verification and delivery
- [x] Independently audit UBS calculations and repair only reproduced defects with UT.
- [x] Run all Python/Node/browser tests; inspect full errors, restore only own generated fixtures if needed.
- [x] Prove >80% changed executable line coverage, retain replay evidence on frozen online snapshot.
- [x] Fresh whole-branch review; fix material findings using RED/GREEN tests.
- [ ] Commit tested changes, push feature branch, create PR, wait current-head four gate prerequisites and Dashboard quality gate, merge and remove temporary branches.
- [ ] Verify refreshed public artifact and data, or report an actual deployment/access blocker without claiming complete online correction.

## Execution rulings / progress
- User explicitly authorized complete repairs; proceed with the existing stack and retained metric semantics without a separate design approval cycle.
- Worktree: managed dashboard-data-integrity; source checkout remains on main.

- Review: independent whole-branch review completed. All reproduced material findings accepted: authoritative historical attempt metadata; strict discovery schema and conflicting duplicates; complete step bounds/running quarantine; run timestamp inversion; serialized workflow/job provenance; neutral outcomes; offline discovery replay; independent NPU detail eligibility; UBS catalog continuation/source audit and missing event identity. Each repair has RED→GREEN regressions. No review finding deferred.
- Ruling: use complete creation-history partitioning rather than an unfiltered full listing, because the live unfiltered endpoint rejects page 401 and current GitHub run counts are approximate. Cost: extra source requests, never a silent completeness shortcut.
- Ruling: keep source-retention and paginated-observation boundaries explicit. Deleted/expired upstream records and an atomic historic state cannot be reconstructed; unprovable values remain unknown.

- Final local verification: full Python suite 1121 tests (10 existing conditional/platform skips, no new skips), Node 372/372, Chromium 78/78, required journeys 17/17. Changed executable lines 336/342 covered (98.2456%), above the mandatory >80% gate. Real PR3097 REST fixture preserves 4208-second queue and quarantines contradictory execution/E2E.
