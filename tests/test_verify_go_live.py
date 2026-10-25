"""ADR-025: go-live readiness gates on success, deployment and public bytes.

A rate-limited (429) collection, a failed required job, a 404 Pages address, or
a missing/failed byte verification must keep the new repository BLOCKED — never
false-green. All three facts must be present and verified before READY.
"""
import unittest

from scripts.verify_go_live import go_live_readiness


def run(conclusion="success", rate_limited=False, run_id="39976648600"):
    return {"id": run_id, "conclusion": conclusion, "rate_limited": rate_limited}


def job(job_id="120492873555", conclusion="success"):
    return {"id": job_id, "conclusion": conclusion}


def site(status=200, url="https://tianli-backkom.github.io/ubs_core_monitor/"):
    return {"url": url, "http_status": status}


def verification(verified=True):
    return {"verified": verified, "fingerprint": "sha256:abc"}


class GoLiveReadinessTests(unittest.TestCase):
    def test_fixed_reproduction_inputs_stay_blocked(self):
        # Production run 39976648600 with the failed job 120492873555 and a 404
        # new-repo Pages address: no successful round, no deployment, no bytes.
        ready, problems = go_live_readiness(
            run(conclusion="success"),
            failed_jobs=[job(conclusion="failure")],
            site_probe=site(status=404),
            public_verification=None,
        )
        self.assertFalse(ready)
        text = "\n".join(problems)
        self.assertIn("120492873555", text)
        self.assertIn("404", text)
        self.assertIn("byte-level verification", text)

    def test_rate_limited_collection_is_not_ready(self):
        ready, problems = go_live_readiness(
            run(rate_limited=True),
            failed_jobs=[],
            site_probe=site(),
            public_verification=verification(),
        )
        self.assertFalse(ready)
        self.assertIn("429", "\n".join(problems))

    def test_missing_pages_probe_is_not_ready(self):
        ready, problems = go_live_readiness(
            run(), failed_jobs=[], site_probe=None, public_verification=verification())
        self.assertFalse(ready)

    def test_unverified_public_bytes_are_not_ready(self):
        ready, problems = go_live_readiness(
            run(), failed_jobs=[], site_probe=site(), public_verification=verification(False))
        self.assertFalse(ready)

    def test_all_three_verified_facts_are_ready(self):
        ready, problems = go_live_readiness(
            run(), failed_jobs=[job()], site_probe=site(), public_verification=verification())
        self.assertTrue(ready)
        self.assertEqual(problems, [])

    def test_no_collection_run_is_not_ready(self):
        ready, problems = go_live_readiness(None)
        self.assertFalse(ready)


if __name__ == "__main__":
    unittest.main()