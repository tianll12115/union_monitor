"""Local UT must fail closed before push or PR creation."""
import subprocess
import re
import unittest
from pathlib import Path
from unittest.mock import patch

from scripts import submit_pr, run_checks

ROOT = Path(__file__).resolve().parents[1]


class MaintenanceTests(unittest.TestCase):
    def test_documentation_links_resolve(self):
        for filename in ('CONTRIBUTING.md', 'docs/README.md'):
            source = ROOT / filename
            for link in re.findall(r'\[[^\]]+\]\(([^)]+)\)', source.read_text('utf-8')):
                if '://' not in link and not link.startswith('#'):
                    self.assertTrue((source.parent / link.split('#')[0]).is_file(), link)

    def test_one_lockfile_and_development_parser_are_declared(self):
        self.assertTrue((ROOT / 'package-lock.json').is_file())
        self.assertFalse((ROOT / 'pnpm-lock.yaml').exists())
        self.assertIn('PyYAML==6.0.3', (ROOT / 'requirements-dev.txt').read_text())

    def test_pre_push_rejects_main_and_executes_unit_gate(self):
        hook = (ROOT / '.githooks/pre-push').read_text()
        self.assertIn('scripts/run_checks.py', hook)
        self.assertIn('--pre-push', hook)


class CheckTests(unittest.TestCase):
    def test_push_rejects_main_foreign_commit_and_malformed_refs(self):
        head = 'a' * 40
        for records in ([f'refs/heads/test {head} refs/heads/main {head}'],
                        [f'refs/heads/other {"b" * 40} refs/heads/other {head}'],
                        ['malformed']):
            with self.subTest(records=records), self.assertRaises(ValueError):
                run_checks.verify_push_refs(records, head)

    def test_push_accepts_only_tested_head_and_branch_deletion(self):
        head = 'a' * 40
        run_checks.verify_push_refs([f'refs/heads/test {head} refs/heads/test {head}'], head)
        run_checks.verify_push_refs([f'(delete) {"0" * 40} refs/heads/old {head}'], head)

    @patch('scripts.run_checks.check')
    @patch('scripts.run_checks.git_output')
    def test_pre_push_rejects_dirty_tree_before_tests(self, git, check):
        git.side_effect = ['a' * 40, 'codex/test', ' M file.py']
        with self.assertRaises(ValueError):
            run_checks.pre_push([])
        check.assert_not_called()

    @patch('scripts.run_checks.check')
    @patch('scripts.run_checks.git_output')
    def test_pre_push_rechecks_identity_and_clean_tree_after_ut(self, git, check):
        head = 'a' * 40
        for final in [('b' * 40, 'codex/test', ''),
                      (head, 'codex/other', ''), (head, 'codex/test', ' M file.py')]:
            git.side_effect = [head, 'codex/test', '', *final]
            with self.subTest(final=final), self.assertRaises(ValueError):
                run_checks.pre_push([f'refs/heads/test {head} refs/heads/test {head}'])

    def test_unit_commands_include_both_full_suites(self):
        commands = run_checks.commands(browser=False)
        self.assertTrue(any('discover' in c and 'tests' in c for c in commands))
        node = next(c for c in commands if '--test' in c)
        self.assertGreater(len(node), 30)
        self.assertTrue(all(p.endswith('.test.cjs') for p in node[2:]))

    def test_browser_checks_verify_required_journeys(self):
        commands = run_checks.commands(browser=True)
        self.assertIn(['npm', 'run', 'test:browser'], commands)
        self.assertTrue(any('scripts/verify_basic_junit.py' in c for c in commands))

    @patch('scripts.run_checks.subprocess.run')
    def test_unit_failure_stops_remaining_commands(self, run):
        run.side_effect = subprocess.CalledProcessError(1, 'unit')
        with self.assertRaises(subprocess.CalledProcessError):
            run_checks.check(browser=False)
        self.assertEqual(run.call_count, 1)


class SubmissionTests(unittest.TestCase):
    @patch('scripts.submit_pr.run')
    def test_failed_ut_never_pushes_or_creates_pr(self, run):
        run.side_effect = ['codex/test', '', 'a' * 40, subprocess.CalledProcessError(1, 'UT')]
        with self.assertRaises(subprocess.CalledProcessError):
            submit_pr.submit('title', 'body.md', 'origin')
        self.assertFalse(any(c.args[0][:2] in (['git', 'push'], ['gh', 'pr'])
                             for c in run.call_args_list))

    @patch('scripts.submit_pr.run')
    def test_main_and_detached_head_cannot_be_submitted(self, run):
        for branch in ('main', ''):
            run.reset_mock()
            run.return_value = branch
            with self.assertRaises(ValueError):
                submit_pr.submit('title', 'body.md', 'origin')
            self.assertEqual(run.call_count, 1)

    @patch('scripts.submit_pr.run')
    def test_dirty_tree_cannot_be_submitted(self, run):
        run.side_effect = ['codex/test', ' M README.md']
        with self.assertRaises(ValueError):
            submit_pr.submit('title', 'body.md', 'origin')
        self.assertEqual(run.call_count, 2)

    @patch('scripts.submit_pr.run')
    def test_ut_precedes_push_and_pr_and_targets_requested_remote(self, run):
        head = 'a' * 40
        run.side_effect = ['codex/test', '', head, '', '', head, 'codex/test', '',
                           'https://github.com/tianll12115/union_monitor.git', '']
        submit_pr.submit('title', 'body.md', 'destination')
        commands = [c.args[0] for c in run.call_args_list]
        self.assertIn('scripts/run_checks.py', commands[3])
        self.assertEqual(commands[7], ['git', 'push', 'destination', f'{head}:refs/heads/codex/test'])
        self.assertEqual(commands[-1][-2:], ['--repo', 'https://github.com/tianll12115/union_monitor.git'])

    @patch('scripts.submit_pr.run')
    def test_head_or_branch_changed_during_ut_never_pushes(self, run):
        head = 'a' * 40
        for final_head, final_branch in [('b' * 40, 'codex/test'), (head, 'codex/other')]:
            run.side_effect = ['codex/test', '', head, '', '', final_head, final_branch]
            run.reset_mock()
            with self.subTest(branch=final_branch), self.assertRaises(ValueError):
                submit_pr.submit('title', 'body.md', 'origin')
            self.assertFalse(any(c.args[0][:2] == ['git', 'push'] for c in run.call_args_list))


if __name__ == '__main__':
    unittest.main()
