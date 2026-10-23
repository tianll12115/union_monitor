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
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_MANIFEST = ROOT / "tests" / "browser" / "basic-journeys.json"
DEFAULT_JUNIT = ROOT / "test-results" / "browser-junit.xml"


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
    required = data.get("required") if isinstance(data, dict) else None
    if not isinstance(required, list) or not required:
        raise SystemExit(f"FAIL: manifest {manifest} has no non-empty 'required' list")
    ids = []
    for entry in required:
        if not isinstance(entry, dict) or not entry.get("id"):
            raise SystemExit(f"FAIL: manifest {manifest} has invalid entry {entry!r}")
        ids.append(str(entry["id"]))
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
    """Return (ok, per_id_results)."""
    results = []
    ok = True
    for req_id in required_ids:
        matches = [c for c in cases if req_id in (c.get("name") or "")]
        if not matches:
            results.append((req_id, "FAIL", "not executed (no testcase name contains the id)"))
            ok = False
            continue
        bad = []
        for case in matches:
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
