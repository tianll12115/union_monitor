"""Keep the mandated GitHub submission workflow discoverable in AGENTS.md."""

import unittest
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class AgentsContractTests(unittest.TestCase):
    def setUp(self):
        self.agents = (ROOT / "AGENTS.md").read_text(encoding="utf-8")

    def test_gate_and_pull_request_workflow_are_mandated(self):
        self.assertIn("Dashboard quality gate", self.agents)
        self.assertIn("required_status_checks", self.agents)
        self.assertIn("required_pull_request_reviews", self.agents)
        self.assertIn("Pull Request", self.agents)

    def test_direct_main_push_and_protection_bypass_are_prohibited(self):
        self.assertIn("严禁移除或绕过 `main` 分支保护", self.agents)
        self.assertIn("不得直接推送到 `main`", self.agents)
        self.assertIn("门禁失败（红色）时", self.agents)
        self.assertIn("远端与本地只保留 `main` 一个分支", self.agents)

    def test_gate_only_policy_requires_pr_and_ci_but_no_human_approval(self):
        policy = json.loads((ROOT / '.github/main-protection.json').read_text('utf-8'))
        reviews = policy['required_pull_request_reviews']
        self.assertEqual(reviews['required_approving_review_count'], 0)
        self.assertFalse(reviews['require_last_push_approval'])
        self.assertFalse(reviews['require_code_owner_reviews'])
        self.assertTrue(policy['required_status_checks']['strict'])
        self.assertEqual(policy['required_status_checks']['checks'],
                         [{'context': 'Dashboard quality gate', 'app_id': 15368}])
        self.assertTrue(policy['enforce_admins'])
        self.assertFalse(policy['allow_force_pushes'])
        self.assertFalse(policy['allow_deletions'])
        self.assertIn('无需人工批准', self.agents)
        for filename in ('CONTRIBUTING.md', '.github/pull_request_template.md'):
            text = (ROOT / filename).read_text('utf-8')
            self.assertIn('无需人工批准', text)
            self.assertNotIn('至少一次批准', text)


if __name__ == "__main__":
    unittest.main()
