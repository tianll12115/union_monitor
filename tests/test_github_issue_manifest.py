"""Validate issue drafts/coverage, not GitHub access or dashboard acceptance."""
from collections import Counter
import copy
import json
from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "docs/requirements/2026-10-22-github-issue-manifest.json"
BACKLOG = ROOT / "docs/requirements/2026-10-22-github-issue-backlog.md"
ID_PATTERN = r"(?:UDR|UAR|EC|PSG)-\d{3}"
AC_PATTERN = ID_PATTERN + r"-AC\d{2}"
REPOSITORY_URL = "https://github.com/tianli-Backkom/union_monitor"
NEW_REPOSITORY_URL = "https://github.com/tianll12115/union_monitor"


def validate_manifest(data):
    """Compare the saved publication plan with the independent source specs."""
    source_ids = []
    expected_acs = set()
    assert len(data["source_documents"]) == 4
    for name in data["source_documents"]:
        text = (ROOT / name).read_text(encoding="utf-8")
        source_ids.extend(re.findall(r"^### (" + ID_PATTERN + r")[：:]", text, re.M))
        expected_acs.update(re.findall(r"\b" + AC_PATTERN + r"\b", text))
    assert len(source_ids) == len(set(source_ids)) == 77
    assert len(expected_acs) == 159
    issues = data["issues"]
    assert len(issues) == len({item["key"] for item in issues}) == 34
    assigned = [item_id for item in issues for item_id in item["source_ids"]]
    assert Counter(assigned) == Counter(source_ids), "missing or duplicate requirement"
    actual_acs = []
    for item in issues:
        assert item["source_ids"]
        assert item["title"].startswith("[" + item["key"] + "][P")
        body = item["body"]
        assert "__TRACKER__" not in body
        assert "## 详细需求" in body and "验收清单" in body and "交付与证据" in body
        assert "key=" + item["key"] + " " in body
        assert REPOSITORY_URL + "/issues/17" in body
        assert not re.search(r"^- \[[xX]\] " + AC_PATTERN, body, re.M)
        acs = re.findall(r"^- \[ \] (" + AC_PATTERN + r")：", body, re.M)
        assert len(acs) == len(set(acs)), "duplicate acceptance box"
        for item_id in item["source_ids"]:
            assert sum(ac.startswith(item_id + "-") for ac in acs) >= 2
        assert all(ac.rsplit("-AC", 1)[0] in item["source_ids"] for ac in acs)
        actual_acs.extend(acs)
        if item["remote_status"] == "pending_create":
            assert item["number"] is None and item["url"] is None
        else:
            assert type(item["number"]) is int
            assert item["url"] == REPOSITORY_URL + "/issues/" + str(item["number"])
    assert Counter(actual_acs) == Counter(expected_acs), "missing/duplicate source AC"
    assert data["coverage"] == {
        "canonical_issues": 34, "source_requirements": 77, "acceptance_ids": 159
    }
    created = [item for item in issues if item["number"] is not None]
    pending = [item for item in issues if item["remote_status"] == "pending_create"]
    assert len({item["number"] for item in created}) == len(created)
    assert data["publication"]["created_including_tracker"] == len(created) + 1 == 19
    assert data["publication"]["pending_create"] == len(pending) == 16
    assert data["tracker"]["number"] == 17
    assert data["publication_status"] == "blocked_account_suspended"
    assert data["blocker"]["http_status"] == 403
    assert data["blocker"]["message"] == "Sorry. Your account was suspended"
    adapted = data["adapted_requirement_ids"]
    assert len(adapted) == len(set(adapted)) == 17
    for item_id in adapted:
        body = next(item["body"] for item in issues if item_id in item["source_ids"])
        assert "历史AC→当前验收映射" in body
    # ADR-026: the manifest must declare the new repository's local-ledger
    # tracking, and no issue URL may point to the new repository.
    migration = data["tracking_migration"]
    assert migration["schema_version"] == 1
    assert migration["historical_repository"] == "tianli-Backkom/union_monitor"
    assert migration["current_repository"] == "tianll12115/union_monitor"
    assert migration["mode"] == "local_ledger"
    assert migration["issue_migration"] == "not_migrated"
    for item in issues:
        if item.get("url"):
            assert item["url"].startswith(REPOSITORY_URL + "/"), item["key"]
            assert not item["url"].startswith(NEW_REPOSITORY_URL + "/"), item["key"]
    return True


class GitHubIssueManifestTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data = json.loads(MANIFEST.read_text(encoding="utf-8"))
        cls.by_key = {item["key"]: item for item in cls.data["issues"]}
        cls.backlog = BACKLOG.read_text(encoding="utf-8")

    def test_manifest_preserves_all_requirements_and_acceptance(self):
        self.assertTrue(validate_manifest(self.data))

    def test_tracking_migration_declares_local_ledger_not_new_issues(self):
        migration = self.data["tracking_migration"]
        self.assertEqual(migration["historical_repository"], "tianli-Backkom/union_monitor")
        self.assertEqual(migration["current_repository"], "tianll12115/union_monitor")
        self.assertEqual(migration["mode"], "local_ledger")
        self.assertEqual(migration["issue_migration"], "not_migrated")
        self.assertTrue(all(
            not (item.get("url") or "").startswith(NEW_REPOSITORY_URL)
            for item in self.data["issues"]), "new repo must not claim old-repo issues")

    def test_old_repo_suspension_is_not_a_new_repo_blocker(self):
        self.assertIn("does not treat the old account's suspension",
                      self.data["tracking_migration"]["decision"])

    def test_missing_or_duplicate_requirement_is_rejected(self):
        for mutate in (
            lambda value: value["issues"][0]["source_ids"].pop(),
            lambda value: value["issues"][0]["source_ids"].append("EC-001"),
        ):
            value = copy.deepcopy(self.data)
            mutate(value)
            with self.assertRaises(AssertionError):
                validate_manifest(value)

    def test_removed_or_falsely_checked_acceptance_is_rejected(self):
        for replacement in ("", "- [x] PSG-001-AC01："):
            value = copy.deepcopy(self.data)
            item = next(x for x in value["issues"] if x["key"] == "PSG-001")
            item["body"] = item["body"].replace("- [ ] PSG-001-AC01：", replacement)
            with self.assertRaises(AssertionError):
                validate_manifest(value)

    def test_pending_issue_cannot_claim_a_remote_number(self):
        value = copy.deepcopy(self.data)
        next(x for x in value["issues"] if x["remote_status"] == "pending_create")["number"] = 999
        with self.assertRaises(AssertionError):
            validate_manifest(value)

    def test_backlog_contains_every_unpublished_body_and_pending_correction(self):
        for item in self.data["issues"]:
            with self.subTest(key=item["key"]):
                self.assertIn(item["key"], self.backlog)
                if item["remote_status"] in ("pending_create", "created_pending_body_update"):
                    self.assertIn(item["body"], self.backlog)
        self.assertIn("发布尚未完成", self.backlog)
        self.assertIn(self.data["blocker"]["message"], self.backlog)

    def test_three_deferred_requirements_remain_outside_current_release(self):
        for key in ("UAR-011", "UAR-012", "HIST-THIRD"):
            self.assertIn("后续项", self.by_key[key]["scope"])
            self.assertIn("不作为本期", self.by_key[key]["scope"])

    def test_submission_contract_and_all_basic_mutation_ids_are_preserved(self):
        body = self.by_key["PSG-001"]["body"]
        for token in (
            "最近一次代码提交", "排除重跑", "legacy-observed", "partial",
            "latest_submission_ms", "latest_observed_submission_ms",
            "ubs-latest-code-submission-v1", "104, 103, 102, 101, 105",
        ):
            self.assertIn(token, body)
        for n in range(1, 13):
            self.assertIn(f"BASIC-{n:03d}", self.by_key["PSG-004"]["body"])
            self.assertIn(f"MUT-{n:03d}", self.by_key["PSG-007"]["body"])

    def test_current_scope_corrections_are_saved_for_existing_issues(self):
        updates = {item["key"] for item in self.data["issues"]
                   if item["remote_status"] == "created_pending_body_update"}
        self.assertEqual(updates, {"EC-010", "PSG-005"})
        self.assertIn("P50/P90", self.by_key["EC-010"]["body"])
        self.assertIn("工作台及拆分趋势/记录页面已退役", self.by_key["PSG-005"]["body"])


if __name__ == "__main__":
    unittest.main()
