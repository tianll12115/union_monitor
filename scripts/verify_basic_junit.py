#!/usr/bin/env python3
"""Verify the 12 BASIC journeys actually executed and passed in the JUnit report.

PSG-004-AC01 / PSG-006: the PR gate must not only run Chromium, it must prove
that every required BASIC journey id (tests/browser/basic-journeys.json) appears
as an executed, non-skipped, non-failed, non-errored <testcase> in the JUnit
report that THIS run produced. A stale report, a missing id, a skipped/failed
case, or an absent manifest fails the check (non-zero exit).

Pure standard library only.
"""
import argparse
import json
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_MANIFEST = ROOT / "tests" / "browser" / "basic-journeys.json"
DEFAULT_JUNIT = ROOT / "test-results" / "browser-junit.xml"

# The manifest pins the fixed 12-journey checklist version (ADR-023).
EXPECTED_SCHEMA_VERSION = 1
EXPECTED_JOURNEY_COUNT = 12

# A journey id is claimed only by the literal ``[BASIC-00X]`` token — exact,
# not a substring, so a single name cannot smuggle all 12 ids at once.
TOKEN_RE = re.compile(r"\[(BASIC-\d{3})\]")


def covered_ids(name):
    """Return the set of BASIC journey ids a testcase name claims via exact tokens."""
    return set(TOKEN_RE.findall(name or ""))


def load_required_ids(manifest_path):
    manifest = Path(manifest_path)
    if not manifest.is_file():
        raise SystemExit(
            f"FAIL: BASIC journey manifest not found: {manifest}\n"
            "tests/browser/basic-journeys.json must be committed before the "
            "PR gate can verify the required journeys.")
    try:
        data = json.loads(manifest.read_bytes().decode("utf-8-sig"))
    except (OSError, json.JSONDecodeError) as error:
        raise SystemExit(f"FAIL: cannot read manifest {manifest}: {error}")
    if not isinstance(data, dict):
        raise SystemExit(f"FAIL: manifest {manifest} must be a JSON object")
    if data.get("schema_version") != EXPECTED_SCHEMA_VERSION:
        raise SystemExit(
            f"FAIL: manifest {manifest} schema_version {data.get('schema_version')!r} "
            f"!= fixed {EXPECTED_SCHEMA_VERSION}")
    required = data.get("required")
    if not isinstance(required, list) or not required:
        raise SystemExit(f"FAIL: manifest {manifest} has no non-empty 'required' list")
    if len(required) != EXPECTED_JOURNEY_COUNT:
        raise SystemExit(
            f"FAIL: manifest {manifest} declares {len(required)} journeys, "
            f"not the fixed {EXPECTED_JOURNEY_COUNT}")
    ids = []
    for entry in required:
        if not isinstance(entry, dict) or not entry.get("id"):
            raise SystemExit(f"FAIL: manifest {manifest} has invalid entry {entry!r}")
        ids.append(str(entry["id"]))
    if len(set(ids)) != len(ids):
        raise SystemExit(f"FAIL: manifest {manifest} has duplicate journey ids")
    return ids


def parse_testcases(junit_path):
    junit = Path(junit_path)
    if not junit.is_file():
        raise SystemExit(f"FAIL: JUnit report not found: {junit}")
    try:
        root = ET.fromstring(junit.read_bytes().decode("utf-8-sig"))
    except (OSError, ET.ParseError) as error:
        raise SystemExit(f"FAIL: JUnit report {junit} is not valid XML: {error}")
    if root.tag not in ("testsuites", "testsuite"):
        raise SystemExit(f"FAIL: JUnit report {junit} has unexpected root <{root.tag}>")
    cases = root.findall(".//testcase")
    if not cases:
        raise SystemExit(f"FAIL: JUnit report {junit} contains no <testcase> entries")
    return cases


def check(required_ids, cases):
    """Return (ok, per_id_results).

    Each journey must be executed by its own independent testcase carrying the
    literal ``[BASIC-00X]`` token. A single testcase that claims more than one
    journey id is rejected (it cannot be an independent execution of any one
    journey), and a journey claimed only by such a case is not credited.
    """
    required_set = set(required_ids)
    claimed = [covered_ids(c.get("name") or "") for c in cases]

    # A case claiming more than one journey id is a bypass.
    excluded_ids = set()
    for index, ids in enumerate(claimed):
        extra = sorted(ids & required_set)
        if len(extra) > 1:
            excluded_ids.update(extra)

    results = []
    ok = True
    for req_id in required_ids:
        if req_id in excluded_ids:
            results.append((req_id, "FAIL",
                            "claimed only by a testcase that covers multiple journeys"))
            ok = False
            continue
        matches = [i for i, ids in enumerate(claimed) if req_id in ids]
        if not matches:
            results.append((req_id, "FAIL",
                            "not executed (no testcase carries the [id] literal token)"))
            ok = False
            continue
        bad = []
        for index in matches:
            case = cases[index]
            for child in case:
                tag = child.tag.rsplit("}", 1)[-1]
                if tag in ("skipped", "failure", "error"):
                    bad.append(tag)
        if bad:
            results.append((req_id, "FAIL",
                            f"executed but marked {'/'.join(sorted(set(bad)))}"))
            ok = False
        else:
            results.append((req_id, "PASS", ""))
    return ok, results


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--junit", default=str(DEFAULT_JUNIT),
                        help="Playwright JUnit XML path (default test-results/browser-junit.xml)")
    parser.add_argument("--manifest", default=str(DEFAULT_MANIFEST),
                        help="BASIC journey manifest (default tests/browser/basic-journeys.json)")
    parser.add_argument("--list", action="store_true",
                        help="print the required BASIC ids and exit")
    args = parser.parse_args(argv)

    required_ids = load_required_ids(args.manifest)

    if args.list:
        for req_id in required_ids:
            print(req_id)
        return 0

    cases = parse_testcases(args.junit)
    if len(cases) < len(required_ids):
        raise SystemExit(
            f"FAIL: JUnit report has {len(cases)} testcase(s), fewer than the "
            f"{len(required_ids)} required BASIC journeys")

    ok, results = check(required_ids, cases)

    for req_id, status, detail in results:
        suffix = f" — {detail}" if detail else ""
        print(f"{status}: {req_id}{suffix}")

    print(f"summary: {sum(1 for _, s, _ in results if s == 'PASS')}/{len(results)} "
          f"required BASIC journeys passed; total testcases={len(cases)}")
    if not ok:
        print("FAIL: one or more required BASIC journeys were not executed and passed",
              file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
