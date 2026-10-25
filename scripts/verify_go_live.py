#!/usr/bin/env python3
"""ADR-025 go-live readiness gate (pre-enablement acceptance).

The new repository's public site must not be declared live until three
independent facts are all present and verified:

1. a successful production collection run — a 429/rate-limit is a source
   failure and must never read as green;
2. a public Pages deployment probe returning 200 — a 404/absent site blocks;
3. a byte-level verification of the public resources against the expected
   build fingerprint.

This module is a pure, offline decision function; it never triggers collection
or deployment. The fixed reproduction inputs (production run 39976648600, the
failed job 120492873555 and the new-repo Pages address) stay blocked until real
evidence replaces them.
"""
import argparse
import json
from pathlib import Path


def go_live_readiness(production_run=None, *, failed_jobs=(), site_probe=None,
                      public_verification=None):
    """Return ``(ready, problems)`` for the three go-live facts above."""
    problems = []
    # 1. Successful production collection; rate-limit must not false-green.
    if production_run is None:
        problems.append("production collection: no run recorded")
    elif production_run.get("rate_limited"):
        problems.append(f"production collection run {production_run.get('id')!r} "
                        "was rate-limited (429) and stays blocked")
    elif production_run.get("conclusion") != "success":
        problems.append(f"production collection run {production_run.get('id')!r} "
                        f"concluded {production_run.get('conclusion')!r}, not success")
    # 2. Every required job of the round must have succeeded.
    for job in list(failed_jobs or ()):
        if job.get("conclusion") != "success":
            problems.append(f"required job {job.get('id')!r} concluded "
                            f"{job.get('conclusion')!r}, not success")
    # 3. Public Pages must be deployed (200), not 404/absent.
    if site_probe is None:
        problems.append("public deployment: no Pages probe recorded")
    elif site_probe.get("http_status") != 200:
        problems.append(f"public deployment {site_probe.get('url')!r} returned "
                        f"{site_probe.get('http_status')!r}, not 200")
    # 4. Public bytes must match the expected build fingerprint.
    if public_verification is None:
        problems.append("public deployment: no byte-level verification recorded")
    elif not public_verification.get("verified"):
        problems.append("public deployment: byte-level verification did not pass")
    return (not problems), problems


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--evidence", default=None,
                        help="optional JSON file describing the collected go-live facts")
    args = parser.parse_args(argv)
    if args.evidence:
        doc = json.loads(Path(args.evidence).read_text(encoding="utf-8"))
        ready, problems = go_live_readiness(
            doc.get("production_run"),
            failed_jobs=doc.get("failed_jobs", []),
            site_probe=doc.get("site_probe"),
            public_verification=doc.get("public_verification"),
        )
    else:
        ready, problems = go_live_readiness()
    print("GO-LIVE READY" if ready else "GO-LIVE BLOCKED")
    for problem in problems:
        print(f"- {problem}")
    return 0 if ready else 1


if __name__ == "__main__":
    raise SystemExit(main())