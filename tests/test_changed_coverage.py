"""Changed executable lines must be measured, with coverage strictly above 80%."""
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from scripts import verify_changed_coverage as gate


class ChangedCoverageTests(unittest.TestCase):
    def test_diff_collects_added_ranges_and_ignores_deletions_and_test_files(self):
        diff = '+++ b/web/a.js\n@@ -2,2 +2,3 @@\n+++ b/tests/a.test.cjs\n@@ -0,0 +1 @@\n+++ /dev/null\n@@ -1 +0,0 @@\n'
        self.assertEqual(gate.changed_lines(diff), {'web/a.js': {2, 3, 4}})

    def test_lcov_unions_hits_and_normalizes_absolute_paths(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            report = root / 'coverage.info'
            report.write_text(f'SF:{root / "web/a.js"}\nDA:2,0\nDA:3,1\nend_of_record\nSF:web/a.js\nDA:2,4\nend_of_record\n', encoding='utf-8')
            self.assertEqual(gate.read_lcov([report], root), {'web/a.js': {2: True, 3: True}})
            report.write_text('SF:web\\a.js\nDA:2,1\n', encoding='utf-8')
            self.assertEqual(gate.read_lcov([report], root), {'web/a.js': {2: True}})

    def test_missing_report_or_unmeasured_file_fails_closed(self):
        with self.assertRaises(FileNotFoundError):
            gate.read_lcov(['missing-report.info'], Path.cwd())
        with self.assertRaises(ValueError):
            gate.evaluate({'web/new.js': {1}}, {})

    def test_exactly_80_percent_fails_and_nonexecutable_lines_do_not_count(self):
        changes = {'web/a.js': set(range(1, 7))}
        result = gate.evaluate(changes, {'web/a.js': {i: i < 5 for i in range(1, 6)}})
        self.assertFalse(result['passed'])
        self.assertEqual(result['percent'], 80)
        self.assertEqual(result['uncovered'], {'web/a.js': [5]})
        self.assertTrue(gate.evaluate(changes, {'web/a.js': {i: True for i in range(1, 6)}})['passed'])
        self.assertTrue(gate.evaluate({}, {})['passed'])

    @patch('scripts.verify_changed_coverage.subprocess.check_output')
    def test_cli_writes_inspectable_report_and_returns_failure_for_low_coverage(self, git):
        git.return_value = '+++ b/web/a.js\n@@ -0,0 +1,2 @@\n'
        with tempfile.TemporaryDirectory() as tmp:
            report = Path(tmp) / 'coverage.info'
            output = Path(tmp) / 'result.json'
            report.write_text('SF:web/a.js\nDA:1,1\nDA:2,0\n', encoding='utf-8')
            with patch('builtins.print'):
                self.assertEqual(gate.main(['--lcov', str(report), '--output', str(output)]), 1)
                self.assertIn('50.0', output.read_text())
                report.write_text('SF:web/a.js\nDA:1,1\nDA:2,1\n', encoding='utf-8')
                self.assertEqual(gate.main(['--lcov', str(report), '--output', str(output)]), 0)
                self.assertEqual(git.call_args.kwargs['encoding'], 'utf-8')
                self.assertEqual(gate.main(['--lcov', str(report) + '.absent']), 1)
