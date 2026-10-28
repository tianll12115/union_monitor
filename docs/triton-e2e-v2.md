# Triton Integration Tests E2E v2

PR #2280 previously showed 2882.48 minutes because independent workflows on the same PR+SHA were grouped across two days. The main Actions link referred to a different 25-minute workflow. A shared SHA cannot prove a shared trigger.

The published v2 metric uses configured Integration Tests workflow ID `241783889` and path `.github/workflows/ci.yml`. Every run/attempt is an independent record. First-attempt E2E is workflow creation to the last completed, non-skipped job, including queue time. Parallel jobs are not summed. Missing or incomplete job evidence and invalid time ranges leave the metric empty. `updated_at` is never a substitute for a job completion timestamp.

Reruns retain their own attempt start and completion evidence. Their pre-start queue origin is unknown, so their observed duration is shown separately and excluded from completed E2E percentiles. Historical attempts whose start was derived from the first job creation are labeled accordingly. Each source link specifies its attempt. Cross-workflow whole-gate duration remains undetermined.

Auxiliary workflows retain source/NPU evidence but cannot affect E2E samples, axes or history counts. Legacy snapshots cannot qualify as v2 by changing a label: the UI disables old E2E values until a fresh v2 collection is available. CSV numerical columns stay compatible; the qualification sidecar identifies the new metric and eligibility.

Scatter points use measured coordinates with no collision displacement or short leader lines. Selecting an overlapping location offers all nearby records. Details group observed Integration Tests runs by SHA, preserving same-SHA reruns and links; the snapshot's historical records may extend beyond the current chart selection and do not change its KPI scope. This is observed history, not a claim of complete PR history.

Regression protection includes frozen public run/job evidence for PR #2280, independent source-to-metric reconciliation, mutation of links/endpoints/eligibility, missing and skipped jobs, independent same-SHA runs, reruns, auxiliary-axis pollution, true-coordinate overlaps, historical navigation and old-schema rejection. Full Python, Node and browser suites and changed-line coverage above 80% remain mandatory in the PR quality gate.
