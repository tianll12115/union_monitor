"""Validate the ADR-027..046 supplementary acceptance ledger (ADR-027..046).

Every supplement closes its declared original ACs, records the existing test
coverage that verifies the implemented part, and keeps the missing
real-browser/production/frozen evidence as an explicit unverified gap instead
of relabeling it as completed.
"""
import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LEDGER = ROOT / "audit" / "2026-10-26" / "adversarial-remediation-supplement.json"

EXPECTED_ORIGINAL_ACS = {
    "ADR-027": ["UDR-001-AC01", "UDR-001-AC02"],
    "ADR-028": ["UDR-006-AC01"],
    "ADR-029": ["UDR-007-AC01", "UDR-007-AC02"],
    "ADR-030": ["UDR-008-AC02"],
    "ADR-031": ["UDR-011-AC01", "UDR-011-AC02"],
    "ADR-032": ["UDR-018-AC01", "UDR-018-AC02"],
    "ADR-033": ["UDR-021-AC01", "UDR-021-AC02"],
    "ADR-034": ["UDR-022-AC01", "UDR-022-AC02"],
    "ADR-035": ["UDR-029-AC01", "UDR-029-AC02"],
    "ADR-036": ["UDR-032-AC01", "UDR-032-AC02"],
    "ADR-037": ["UDR-036-AC02"],
    "ADR-038": ["UAR-001-AC01", "UAR-001-AC02"],
    "ADR-039": ["UAR-002-AC01", "UAR-002-AC02"],
    "ADR-040": ["UAR-005-AC01", "UAR-005-AC02"],
    "ADR-041": ["UAR-013-AC01", "UAR-013-AC02"],
    "ADR-042": ["EC-002-AC01", "EC-002-AC02"],
    "ADR-043": ["EC-004-AC01", "EC-004-AC02"],
    "ADR-044": ["EC-005-AC01"],
    "ADR-045": ["EC-008-AC01", "EC-008-AC02", "EC-008-AC03"],
    "ADR-046": ["PSG-005-AC01", "PSG-005-AC02"],
}

VALID_STATUS = {"partial", "unverified", "verified"}


class SupplementLedgerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.doc = json.loads(LEDGER.read_text(encoding="utf-8"))
        cls.by_adr = {s["adr"]: s for s in cls.doc["supplements"]}

    def test_covers_all_twenty_supplements_in_order(self):
        ids = [s["adr"] for s in self.doc["supplements"]]
        self.assertEqual(ids, [f"ADR-{n:03d}" for n in range(27, 47)])

    def test_each_supplement_closes_its_declared_original_acs(self):
        for adr, expected in EXPECTED_ORIGINAL_ACS.items():
            self.assertEqual(self.by_adr[adr]["original_ac_ids"], expected, adr)

    def test_every_ac_entry_is_honest_and_names_real_evidence(self):
        for supplement in self.doc["supplements"]:
            for entry in supplement["ac_ledger"]:
                with self.subTest(adr=supplement["adr"], ac=entry["ac"]):
                    self.assertIn(entry["status"], VALID_STATUS, entry)
                    if entry["status"] == "unverified":
                        self.assertTrue(entry.get("unverified"), entry)
                    else:
                        self.assertTrue(entry.get("verified_via"), entry)
                    for path in entry.get("verified_via", []):
                        self.assertTrue((ROOT / path).is_file(), f"{supplement['adr']} {path}")

    def test_no_supplement_is_falsely_fully_verified_without_a_gap(self):
        # A supplement may only be fully verified when every AC is 'verified';
        # anything with a remaining real-evidence gap stays partial/unverified.
        for supplement in self.doc["supplements"]:
            statuses = {e["status"] for e in supplement["ac_ledger"]}
            self.assertTrue(statuses & {"partial", "unverified"},
                            f"{supplement['adr']} must not claim full closure without real evidence")


if __name__ == "__main__":
    unittest.main()
