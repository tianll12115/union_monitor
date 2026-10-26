"""ADR-023: the BASIC JUnit verifier requires exact, independent journey cases.

One testcase must not cover multiple BASIC journeys; each of the fixed 12
journeys must carry its own literal ``[BASIC-00X]`` token. A name that smuggles
all 12 ids into a single case must fail the check instead of counting as 12
independent executions.
"""
import json
import tempfile
import unittest
import xml.etree.ElementTree as ET
from unittest.mock import patch
from pathlib import Path

from scripts import verify_basic_junit as vj


def case(name, status=None):
    el = ET.Element("testcase", {"name": name})
    if status:
        ET.SubElement(el, status)
    return el


def required_ids():
    return [f"BASIC-{i:03d}" for i in range(1, 13)]


class ExactTokenTests(unittest.TestCase):
    def test_production_shape_dialog_layout_is_a_required_journey(self):
        self.assertIn('TRITON-005', vj.REQUIRED_SCATTER_IDS)

    def test_cli_rejects_report_omitting_the_entire_scatter_suite(self):
        with tempfile.TemporaryDirectory() as tmp:
            report = Path(tmp) / 'junit.xml'
            root = ET.Element('testsuite')
            root.extend(case(f'[{i}] journey') for i in required_ids())
            root.extend(case(f'unrelated-{i}') for i in range(len(vj.REQUIRED_SCATTER_IDS)))
            ET.ElementTree(root).write(report, encoding='utf-8')
            with patch('builtins.print'):
                self.assertEqual(vj.main(['--junit', str(report)]), 1)

    def test_scatter_tokens_are_required_even_when_all_basic_journeys_pass(self):
        self.assertEqual(vj.covered_ids('[TRITON-003] warm navigation'), {'TRITON-003'})
        ids = required_ids() + list(vj.REQUIRED_SCATTER_IDS)
        cases = [case(f'[{i}] journey') for i in required_ids()]
        self.assertFalse(vj.check(ids, cases)[0])
        for scatter_id in vj.REQUIRED_SCATTER_IDS:
            cases.append(case(f'[{scatter_id}] scatter'))
        self.assertTrue(vj.check(ids, cases)[0])
        for status in ('skipped', 'failure', 'error'):
            with self.subTest(status=status):
                self.assertFalse(vj.check(ids, cases[:-1] + [case(f'[{vj.REQUIRED_SCATTER_IDS[-1]}] scatter', status)])[0])

    def test_covered_ids_match_the_literal_token_only(self):
        self.assertEqual(vj.covered_ids("[BASIC-001] journey"), {"BASIC-001"})
        self.assertEqual(vj.covered_ids("BASIC-0010 no brackets"), set())
        self.assertEqual(vj.covered_ids("plain name"), set())
        self.assertEqual(vj.covered_ids("[BASIC-001] and [BASIC-002]"),
                         {"BASIC-001", "BASIC-002"})

    def test_twelve_independent_cases_pass(self):
        ids = required_ids()
        cases = [case(f"[{i}] journey") for i in ids]
        ok, results = vj.check(ids, cases)
        self.assertTrue(ok)
        self.assertEqual(sum(1 for _, s, _ in results if s == "PASS"), 12)

    def test_single_case_claiming_all_twelve_ids_is_rejected(self):
        ids = required_ids()
        combined = " ".join(f"[{i}]" for i in ids)
        cases = [case(combined)] + [case(f"arbitrary-{i}") for i in range(11)]
        ok, results = vj.check(ids, cases)
        self.assertFalse(ok)
        self.assertEqual(sum(1 for _, s, _ in results if s == "PASS"), 0, results)
        self.assertTrue(any("multiple journeys" in d for _, _, d in results), results)

    def test_two_journeys_in_one_case_is_rejected(self):
        cases = [case("[BASIC-001] [BASIC-002] combined")] + \
                [case(f"[BASIC-{i:03d}] journey") for i in range(3, 13)]
        ok, results = vj.check(required_ids(), cases)
        self.assertFalse(ok)
        self.assertFalse(any(s == "PASS" and i in ("BASIC-001", "BASIC-002")
                             for i, s, _ in results), results)

    def test_failed_or_skipped_independent_case_is_rejected(self):
        ids = required_ids()
        cases = [case(f"[{i}] journey") for i in ids]
        cases[3] = case("[BASIC-004] journey", status="failure")
        ok, results = vj.check(ids, cases)
        self.assertFalse(ok)
        self.assertTrue(any(i == "BASIC-004" and s == "FAIL" for i, s, _ in results))

    def test_manifest_pins_schema_version_and_twelve_journeys(self):
        with tempfile.TemporaryDirectory() as tmp:
            bad_version = Path(tmp) / "bad-version.json"
            bad_version.write_text(json.dumps({"schema_version": 2, "required": [
                {"id": f"BASIC-{i:03d}"} for i in range(1, 13)]}), encoding="utf-8")
            with self.assertRaises(SystemExit):
                vj.load_required_ids(bad_version)

            short = Path(tmp) / "short.json"
            short.write_text(json.dumps({"schema_version": 1, "required": [
                {"id": "BASIC-001"}]}), encoding="utf-8")
            with self.assertRaises(SystemExit):
                vj.load_required_ids(short)


if __name__ == "__main__":
    unittest.main()
