# Triton Integration Tests E2E v2

PR #2280 previously showed 2882.48 minutes because independent workflows on the same PR+SHA were grouped across two days. The main Actions link referred to a different 25-minute workflow. A shared SHA cannot prove a shared trigger.

The published v2 metric uses both verified Integration Tests identity pairs: `241783889` / `.github/workflows/ci.yml` and `348219361` / `.github/workflows/ascend-ci.yml`. Names alone never establish identity. An unknown Integration Tests name or mismatched registered ID/path blocks publication until scope is verified. Every run/attempt is an independent record. First-attempt E2E is workflow creation to the last completed, non-skipped job, including queue time. Parallel jobs are not summed. Missing or incomplete job evidence and invalid time ranges leave the metric empty. `updated_at` is never a substitute for a job completion timestamp.

Source timestamps that contradict themselves — a job that completed before it started, or a run whose completion precedes its creation — are a source defect, not a measurement. Such an attempt is quarantined: its `end_at` and `duration_seconds` stay empty, its qualification reason is `source_timestamp_inversion`, it never enters completed percentiles, and the quality gate discloses the anomaly as a warning instead of withholding the whole refresh. A duration derived from contradictory evidence still fails the gate; nothing is clamped to zero and nothing is borrowed from `updated_at`.

Reruns retain their own attempt start and completion evidence. Their pre-start queue origin is unknown, so their observed duration is shown separately and excluded from completed E2E percentiles. Historical attempts whose start was derived from the first job creation are labeled accordingly. Each source link specifies its attempt. Cross-workflow whole-gate duration remains undetermined.

Auxiliary workflows retain source/NPU evidence but cannot affect E2E samples, axes or history counts. Legacy snapshots cannot qualify as v2 by changing a label: the UI disables old E2E values until a fresh v2 collection is available. CSV numerical columns stay compatible; the qualification sidecar identifies the new metric and eligibility.

Scatter points use measured coordinates with no collision displacement or short leader lines. Selecting an overlapping location offers all nearby records. Details group observed Integration Tests runs by SHA, preserving same-SHA reruns and links; the snapshot's historical records may extend beyond the current chart selection and do not change its KPI scope. This is observed history, not a claim of complete PR history.

Regression protection includes frozen public run/job evidence for PR #2280, independent source-to-metric reconciliation, mutation of links/endpoints/eligibility, missing and skipped jobs, independent same-SHA runs, reruns, auxiliary-axis pollution, true-coordinate overlaps, historical navigation and old-schema rejection. Full Python, Node and browser suites and changed-line coverage above 80% remain mandatory in the PR quality gate.

## Accuracy and completeness gates (2026-11-13)

Discovery partitions the complete creation history of the two PR event types through a fixed discovery cutoff. Inclusive whole-second intervals have no split gaps. A declared or actual 1,000-run boundary is split again; a saturated single second is a hard error. Workflow-run counts are approximate under GitHub's September 2026 API change, so counts guide splitting while actual pages and Link headers establish enumeration. Unfiltered listing is not a completeness proof: the public endpoint can reject pages beyond its 40,000-row cap. Ordinary out-of-window first attempts need no jobs; every discovered rerun is enumerated before per-attempt window selection. Deleted/expired source evidence cannot be recovered, and the collection is paginated rather than an atomic historical snapshot.

Source coverage is derived from each source attempt's time, not from whichever rows survived rendering. An omitted in-window identity remains unaccounted and blocks publication. PR association ambiguity remains a visible unknown record; transport failures cannot masquerade as legal ambiguity.

Source steps outside their job timestamps quarantine execution and E2E; raw timestamps, queue evidence, anomaly reason and source links survive. The browser must not reconstruct a quarantined execution span from the contradictory endpoints. Skipped, neutral and unknown terminal outcomes remain distinct from success; all selected run statuses remain counted.

The page shows E2E and NPU included/excluded counts and reasons against the same selected run population. NPU spans all workflows and measures each run's maximum NPU job wait, not total PR queue time. PR counts exclude unknown identities, which have their own record count. A previously published snapshot that excludes a now-registered CI identity disables its incomplete E2E statistics until recollection; its independently measured NPU data stays visible.

Reference: https://github.blog/changelog/2026-09-25-changes-to-query-results-in-the-github-actions-api-and-ui/
