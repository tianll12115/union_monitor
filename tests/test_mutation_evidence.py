"""ADR-024: mutation fault evidence must bind replayable evidence, not prose.

Each MUT entry must carry a replay block with its detection command and the
baseline SHA, and each of patch / raw-output / JUnit-or-trace must either hold
real evidence or an explicit ``unverified:`` marker. A natural-language-only
entry (fault/detection/observed text with no replay block) is rejected.
"""
import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EVIDENCE = (ROOT / "audit" / "2026-10-22" / "pr-submission-gate-review"
            / "mutation-evidence.json")

UNVERIFIED_PREFIX = "unverified:"
REPLAY_VERIFIABLE_FIELDS = ("patch", "output", "junit_or_trace")


def is_evidence(value):
    return isinstance(value, str) and bool(value.strip()) \
        and not value.lower().startswith(UNVERIFIED_PREFIX)


def is_explicit_unverified(value):
    return isinstance(value, str) and bool(value.strip()) \
        and value.lower().startswith(UNVERIFIED_PREFIX)


def validate(doc):
    """Return a list of problem strings; empty means the evidence is sound."""
    problems = []
    baseline = doc.get("baseline") or {}
    sha = baseline.get("commit")
    if not is_evidence(sha):
        problems.append("baseline.commit must bind the current SHA")
    mutations = doc.get("mutations")
    if not isinstance(mutations, list) or len(mutations) != 12:
        problems.append("mutations must be exactly 12 entries")
        return problems
    seen = set()
    for m in mutations:
        mid = m.get("id")
        if not is_evidence(mid) or mid in seen:
            problems.append(f"invalid or duplicate mutation id {mid!r}")
            continue
        seen.add(mid)
        if m.get("restored") is not True:
            problems.append(f"{mid}: must be restored to green")
        if not is_evidence(m.get("detection")):
            problems.append(f"{mid}: missing detection command")
        if not is_evidence(m.get("observed")):
            problems.append(f"{mid}: missing observed output summary")
        replay = m.get("replay")
        if not isinstance(replay, dict):
            problems.append(f"{mid}: natural-language only, missing replay evidence block")
            continue
        if not is_evidence(replay.get("command")):
            problems.append(f"{mid}: replay.command missing")
        for field in REPLAY_VERIFIABLE_FIELDS:
            value = replay.get(field)
            if not (is_evidence(value) or is_explicit_unverified(value)):
                problems.append(
                    f"{mid}: replay.{field} must carry evidence or an explicit "
                    "unverified marker")
        if replay.get("sha") != sha:
            problems.append(f"{mid}: replay.sha must equal baseline.commit")
    if not is_evidence(doc.get("replay_policy")):
        problems.append("replay_policy must declare evidence availability")
    return problems


class MutationEvidenceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.doc = json.loads(EVIDENCE.read_text(encoding="utf-8"))

    def test_committed_evidence_has_no_problems(self):
        self.assertEqual(validate(self.doc), [])

    def test_twelve_unique_mutations_are_bound(self):
        ids = [m["id"] for m in self.doc["mutations"]]
        self.assertEqual(ids, [f"MUT-{i:03d}" for i in range(1, 13)])
        sha = self.doc["baseline"]["commit"]
        for m in self.doc["mutations"]:
            self.assertEqual(m["replay"]["sha"], sha, m["id"])
            self.assertTrue(is_evidence(m["replay"]["command"]), m["id"])

    def test_natural_language_only_mutation_is_rejected(self):
        doc = json.loads(json.dumps(self.doc))
        for m in doc["mutations"]:
            m.pop("replay", None)
        problems = validate(doc)
        self.assertTrue(problems)
        self.assertTrue(any("natural-language only" in p for p in problems))

    def test_missing_patch_without_unverified_marker_is_rejected(self):
        doc = json.loads(json.dumps(self.doc))
        doc["mutations"][0]["replay"]["patch"] = None
        problems = validate(doc)
        self.assertTrue(any("replay.patch" in p for p in problems))

    def test_mismatched_sha_is_rejected(self):
        doc = json.loads(json.dumps(self.doc))
        doc["mutations"][3]["replay"]["sha"] = "deadbeef"
        problems = validate(doc)
        self.assertTrue(any("replay.sha" in p for p in problems))


if __name__ == "__main__":
    unittest.main()
