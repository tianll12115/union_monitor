"""Discovery boundaries and publication accounting must never hide missing runs."""
import json
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch
from urllib.parse import parse_qs, urlsplit

from triton import dashboard


def run(run_id=1, attempt=1, created="2026-11-10T12:00:00Z", started=None):
    return dict(id=run_id, run_attempt=attempt, pr=42, head_sha="a" * 40,
                created_at=created, run_started_at=started or created,
                name="Integration Tests", event="pull_request", status="completed",
                conclusion="success", jobs_complete=True, jobs=[],
                updated_at="2026-11-10T12:05:00Z", html_url=f"https://github.com/x/actions/runs/{run_id}")


class DiscoveryIntegrityTests(unittest.TestCase):
    def test_rest_attempt_start_is_not_labelled_as_first_job_creation(self):
        from triton.run_e2e import measurement
        base = run(attempt=3)
        metadata = {**base, 'run_attempt': 2, 'run_started_at': '2026-11-10T12:00:00Z'}
        job = dict(id=1, status='completed', conclusion='success',
                   created_at='2026-11-10T12:00:10Z', started_at='2026-11-10T12:00:20Z',
                   completed_at='2026-11-10T12:05:00Z')
        historical = dashboard._historical_attempt_row(base, 2, [job], metadata=metadata)
        result = measurement(historical, '2026-11-11T00:00:00Z')
        self.assertEqual(result['start_at'], metadata['run_started_at'])
        self.assertEqual(result['start_source'], 'attempt_start')
        self.assertFalse(result['e2e_sample_eligible'])
        timing = dashboard.workflow_timing(dict(attempt=2, attempt_source=historical['attempt_source'],
                                               created_at=metadata['created_at'], jobs=[job]), '2026-11-11T00:00:00Z')
        self.assertIsNone(timing['first_job_wait_seconds'], 'REST attempt start does not prove pre-queue origin')

    def test_source_schema_rejects_missing_events_and_noninteger_attempts(self):
        from triton.discovery import full_history_runs
        at = dashboard.dt("2026-11-11T00:00:00Z")
        for changes in [{"event": None}, {"event": "push"}, {"run_attempt": None},
                        {"run_attempt": 0}, {"run_attempt": 2.5}, {"run_attempt": True}]:
            with self.subTest(changes=changes), patch("triton.discovery.interval_runs", return_value=[{**run(), **changes}]):
                with self.assertRaisesRegex(RuntimeError, "event|run_attempt"):
                    full_history_runs(SimpleNamespace(), at - dashboard.timedelta(days=2), at)

    def test_conflicting_source_identity_cannot_overwrite_a_newer_attempt(self):
        from triton.discovery import full_history_runs
        at = dashboard.dt("2026-11-11T00:00:00Z")
        with patch("triton.discovery.interval_runs", side_effect=[[run(attempt=3)], [run(attempt=2)]]):
            with self.assertRaisesRegex(RuntimeError, "conflicting"):
                full_history_runs(SimpleNamespace(), at - dashboard.timedelta(days=2), at)

    def test_historical_result_uses_authoritative_neutral_not_job_success(self):
        base = run(attempt=2)
        job = dict(id=11, name="neutral", status="completed", conclusion="neutral",
                   created_at=base["created_at"], started_at=base["created_at"], completed_at=base["updated_at"])
        unknown = dashboard._historical_attempt_row(base, 1, [job])
        self.assertIsNone(unknown["conclusion"])
        meta = {**base, "run_attempt": 1, "conclusion": "neutral"}
        historical = dashboard._historical_attempt_row(base, 1, [job], metadata=meta)
        self.assertEqual(historical["conclusion"], "neutral")
        self.assertEqual(historical["run_started_at"], meta["run_started_at"])
        self.assertEqual(historical["created_at"], meta["created_at"])
        with self.assertRaisesRegex(RuntimeError, "identity"):
            dashboard._historical_attempt_row(base, 1, [job], metadata={**meta, "id": 999})
        with self.assertRaisesRegex(RuntimeError, "identity"):
            dashboard._historical_attempt_row(base, 1, [job], metadata={**meta, "run_attempt": True})
        with self.assertRaisesRegex(RuntimeError, "lifecycle"):
            dashboard._historical_attempt_row(base, 1, [job], metadata={k:v for k,v in meta.items() if k != "status"})
        with self.assertRaisesRegex(RuntimeError, "workflow identity"):
            dashboard._historical_attempt_row({**base, "workflow_id": 241783889}, 1, [job], metadata={**meta, "workflow_id": 999})

    def test_collector_rejects_failed_historical_metadata_request(self):
        row = run(attempt=2)

        class API:
            calls = 0

            def get(self, path):
                if "/attempts/" in path:
                    raise RuntimeError("historical metadata unavailable")
                return {"total_count": 1, "workflow_runs": [row]}, {}

            def pages(self, path, field):
                return []

        with tempfile.TemporaryDirectory() as temp, patch.object(dashboard, "GitHub", return_value=API()), \
                patch.object(dashboard, "EVIDENCE", Path(temp)), \
                patch("triton.pr_identity.PRResolver.resolve", return_value={"pr": 42}):
            with self.assertRaisesRegex(RuntimeError, "refusing to publish"):
                dashboard.collect(48, "2026-11-11T00:00:00Z")
            errors = json.loads((Path(temp) / "collection-errors.json").read_text(encoding="utf-8"))
            self.assertIn("historical metadata unavailable", errors[0]["jobs_error"])

    def test_actual_thousand_rows_split_even_when_count_underestimates(self):
        from triton.discovery import interval_runs
        at = dashboard.dt("2026-11-10T00:00:00Z")

        class API:
            def get(self, path):
                q = parse_qs(urlsplit(path).query)
                a, b = map(dashboard.dt, q["created"][0].split(".."))
                page = int(q.get("page", [1])[0])
                rows = ([{"id": page * 100 + i} for i in range(100)] if a < b
                        else [{"id": int(a.timestamp())}])
                return {"total_count": 1, "workflow_runs": rows}, {}

        self.assertEqual(len(interval_runs(API(), at, at + dashboard.timedelta(seconds=1), "pull_request")), 2)

    def test_empty_or_invalid_pages_are_rejected(self):
        from triton.discovery import interval_runs
        at = dashboard.dt("2026-11-10T00:00:00Z")
        for response, pattern in [({"workflow_runs": []}, "empty page"),
                                  ({"workflow_runs": None}, "array"),
                                  ({"workflow_runs": [{}]}, "identity")]:
            with self.subTest(response=response):
                class API:
                    def get(self, path):
                        return {"total_count": 1, **response}, {}

                with self.assertRaisesRegex(RuntimeError, pattern):
                    interval_runs(API(), at, at, "pull_request")

    def test_approximate_count_is_not_an_exact_page_length_contract(self):
        from triton.discovery import interval_runs

        class API:
            def get(self, path):
                return {"total_count": 7, "workflow_runs": [{"id": 1}]}, {}

        at = dashboard.dt("2026-11-10T00:00:00Z")
        self.assertEqual(interval_runs(API(), at, at, "pull_request"), [{"id": 1}])

    def test_saturated_40000_count_splits_instead_of_requesting_page_401(self):
        from triton.discovery import interval_runs
        paths = []
        start = dashboard.dt("2026-11-10T00:00:00Z")

        class API:
            def get(self, path):
                paths.append(path)
                query = parse_qs(urlsplit(path).query)
                a, b = map(dashboard.dt, query["created"][0].split(".."))
                count = 40000 if a < b else 1
                return {"total_count": count, "workflow_runs": [{"id": int(a.timestamp())}]}, {}

        rows = interval_runs(API(), start, start + dashboard.timedelta(seconds=1), "pull_request")
        self.assertEqual(len(rows), 2)
        self.assertTrue(all("page=401" not in p for p in paths))

    def test_link_next_on_short_page_is_followed_and_duplicate_page_rejected(self):
        from triton.discovery import interval_runs

        class API:
            def get(self, path):
                q = parse_qs(urlsplit(path).query)
                page = int(q.get("page", [1])[0])
                if q["per_page"] == ["1"]:
                    return {"total_count": 2}, {}
                return {"total_count": 2, "workflow_runs": [{"id": 1}]}, ({"Link": '<https://api.github.com/next?page=2>; rel="next"'} if page == 1 else {})

        at = dashboard.dt("2026-11-10T00:00:00Z")
        with self.assertRaisesRegex(RuntimeError, "duplicate"):
            interval_runs(API(), at, at, "pull_request")

    def test_collection_refuses_to_return_unaccounted_publication(self):
        class API:
            calls = 0

            def get(self, path):
                return {"total_count": 0, "workflow_runs": []}, {}

        with tempfile.TemporaryDirectory() as temp, patch.object(dashboard, "GitHub", return_value=API()), \
                patch.object(dashboard, "EVIDENCE", Path(temp)), \
                patch.object(dashboard, "build_coverage_ledger", return_value={"verified": False}):
            with self.assertRaisesRegex(RuntimeError, "coverage ledger"):
                dashboard.collect(48, "2026-11-11T00:00:00Z")
            self.assertTrue((Path(temp) / "coverage-ledger.json").exists())

    def test_full_history_discovers_old_rerun_and_records_exclusions(self):
        from triton.discovery import full_history_runs
        rows = [run(created="2020-01-01T00:00:00Z", attempt=2),
                run(2, created="2020-01-02T00:00:00Z"),
                run(3, created="2026-11-12T00:00:00Z"),
                run(4, created="2020-01-01T00:00:00Z"), run(5)]

        class API:
            def get(self, path):
                self.path = path
                return {"total_count": len(rows), "workflow_runs": rows}, {}

        api = API()
        result = full_history_runs(api, dashboard.dt("2026-11-09T00:00:00Z"), dashboard.dt("2026-11-11T00:00:00Z"))
        self.assertIn("created=2008-01-01", api.path)
        self.assertIn("event=pull_request", api.path)
        self.assertEqual([r["id"] for r in result], [1, 5])
        ledger = api.discovery_evidence
        self.assertEqual(ledger["enumerated_runs"], 5)
        self.assertEqual(ledger["candidate_runs"], 2)
        self.assertEqual(ledger["excluded_runs"], 3)
        self.assertEqual(ledger["enumerated_runs"], ledger["candidate_runs"] + ledger["excluded_runs"])
        self.assertTrue(all(e["reason"] for e in ledger["entries"]))
        self.assertFalse(any("jobs" in e or "repository" in e for e in ledger["entries"]))

    def test_full_history_rejects_missing_creation_evidence(self):
        from triton.discovery import full_history_runs

        class API:
            def get(self, path):
                return {"total_count": 1, "workflow_runs": [{**run(), "created_at": None}]}, {}

        with self.assertRaisesRegex(RuntimeError, "created_at"):
            full_history_runs(API(), dashboard.dt("2026-11-09T00:00:00Z"), dashboard.dt("2026-11-11T00:00:00Z"))

    def test_omitted_in_window_identity_is_unaccounted(self):
        payload = {"window_start": "2026-11-09T00:00:00Z", "batches": []}
        ledger = dashboard.build_coverage_ledger([run()], payload, "2026-11-11T00:00:00Z")
        self.assertFalse(ledger["verified"])
        self.assertEqual(ledger["unaccounted_count"], 1)

    def test_future_attempt_has_a_future_reason_instead_of_before_window(self):
        payload = {"window_start": "2026-11-09T00:00:00Z", "batches": []}
        row = run(attempt=2, started="2026-11-12T00:00:00Z")
        ledger = dashboard.build_coverage_ledger([row], payload, "2026-11-11T00:00:00Z")
        self.assertTrue(ledger["verified"])
        self.assertIn("after", ledger["entries"][0]["reason"])

    def test_collect_enumerates_intermediate_attempt_even_when_latest_is_future(self):
        row = run(attempt=3, created="2026-11-01T00:00:00Z", started="2026-11-12T00:00:00Z")
        paths = []

        def get(api, path):
            paths.append(path)
            if "/attempts/" in path:
                attempt = int(path.split("/attempts/")[1].split("/")[0])
                at = {1: "2026-11-01", 2: "2026-11-10", 3: "2026-11-12"}[attempt]
                if "/jobs" not in path:
                    return {**row, "run_attempt": attempt, "run_started_at": at + "T12:00:00Z", "updated_at": at + "T12:01:00Z"}, {}
                job = dict(id=100 + attempt, name="NPU", status="completed", conclusion="success",
                           created_at=at + "T12:00:00Z", started_at=at + "T12:00:01Z",
                           completed_at=at + "T12:01:00Z")
                return {"total_count": 1, "jobs": [job]}, {}
            return {"total_count": 1, "workflow_runs": [row]}, {}

        fields = dict(pr=42, pr_title="Test", base_branch="main", head_sha="a" * 40,
                      pr_evidence={"method": "test"})
        with tempfile.TemporaryDirectory() as temp, patch.object(dashboard.GitHub, "get", get), \
                patch("triton.pr_identity.PRResolver.resolve", return_value=fields), \
                patch.object(dashboard, "EVIDENCE", Path(temp)):
            payload = dashboard.collect(48, "2026-11-11T00:00:00Z")
            discovery = json.loads((Path(temp) / "discovery-ledger.json").read_text(encoding="utf-8"))
            self.assertEqual(discovery["candidate_runs"], 1)
            self.assertEqual(discovery["enumerated_runs"], 1)
            self.assertEqual(payload["discovery"]["enumerated_runs"], 1)
            self.assertEqual(payload["discovery"]["candidate_runs"], 1)
            self.assertEqual(payload["discovery"]["excluded_runs"], 0)
        identities = {(w["id"], w["attempt"]) for b in payload["batches"] for w in b["workflows"]}
        self.assertIn((1, 2), identities)
        self.assertNotIn((1, 3), identities)

    def test_odd_second_split_preserves_every_integer_second(self):
        from triton.discovery import interval_runs
        start = dashboard.dt("2026-11-10T00:00:00Z")
        end = dashboard.dt("2026-11-10T00:00:03Z")
        target = dashboard.dt("2026-11-10T00:00:02Z")

        class API:
            def get(self, path):
                query = parse_qs(urlsplit(path).query)
                a, b = map(dashboard.dt, query["created"][0].split(".."))
                rows = [{"id": 2}] if a <= target <= b else []
                return {"total_count": 1001 if b - a > dashboard.timedelta(seconds=2) else len(rows), "workflow_runs": rows}, {}

        self.assertEqual(interval_runs(API(), start, end, "pull_request"), [{"id": 2}])

    def test_saturated_single_second_fails_closed(self):
        from triton.discovery import interval_runs

        class API:
            def get(self, path):
                return {"total_count": 1001}, {}

        at = dashboard.dt("2026-11-10T00:00:00Z")
        with self.assertRaisesRegex(RuntimeError, "single.second"):
            interval_runs(API(), at, at, "pull_request")

    def test_interval_rejects_invalid_counts_and_accepts_empty_range(self):
        from triton.discovery import interval_runs

        class API:
            def get(self, path):
                return {"total_count": True}, {}

        at = dashboard.dt("2026-11-10T00:00:00Z")
        self.assertEqual(interval_runs(API(), at, at - dashboard.timedelta(seconds=1), "pull_request"), [])
        with self.assertRaisesRegex(RuntimeError, "total_count"):
            interval_runs(API(), at, at, "pull_request")
