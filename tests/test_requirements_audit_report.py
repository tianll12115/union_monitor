"""The dated audit must cover every requirement and AC without unsupported closure."""
import copy
import json
import tempfile
import subprocess
import unittest
from pathlib import Path

from scripts.verify_requirements_audit import validate_audit, source_hash, SPEC_FILES


class AuditIntegrityTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        for filename in SPEC_FILES:
            path = self.root / 'docs/requirements' / filename
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text('# Empty fixture\n', encoding='utf-8')
        source = self.root / 'docs/requirements' / SPEC_FILES[0]
        source.write_text('### UDR-001：fixture\n- UDR-001-AC01：one\n- UDR-001-AC02：two\n', encoding='utf-8')
        evidence = self.root / 'web/demo.js'
        evidence.parent.mkdir()
        evidence.write_text('one\ntwo\n', encoding='utf-8')
        self.ledger = {'schema_version': 1, 'baseline': 'a' * 40,
            'inputs': {str(source.relative_to(self.root)): source_hash(source)},
            'requirements': [{'id': 'UDR-001', 'title': 'fixture', 'scope': 'current',
                'status': 'partial', 'summary': 'First AC confirmed, second incomplete.',
                'reasonableness': {'judgement': 'retain', 'reason': 'user value', 'recommendation': 'complete it'},
                'acs': [{'id': 'UDR-001-AC01', 'status': 'complete', 'detail': 'observed',
                         'evidence': [{'path': 'web/demo.js', 'line': 1, 'note': 'observed'}]},
                        {'id': 'UDR-001-AC02', 'status': 'not_complete', 'detail': 'counterexample',
                         'evidence': [{'path': 'web/demo.js', 'line': 2, 'note': 'counterexample'}]}]}]}
        self.report = '### UDR-001：fixture\nUDR-001-AC01\nUDR-001-AC02\n'

    def check(self, ledger=None, report=None):
        return validate_audit(ledger or self.ledger, self.root,
                              self.report if report is None else report)

    def test_valid_small_fixture_has_no_hard_coded_77_requirement_dependency(self):
        self.assertEqual(self.check(), [])

    def test_missing_requirement_or_ac_fails(self):
        for target in ('requirement', 'ac'):
            ledger = copy.deepcopy(self.ledger)
            if target == 'requirement': ledger['requirements'].clear()
            else: ledger['requirements'][0]['acs'].pop()
            self.assertTrue(self.check(ledger))

    def test_duplicate_unknown_and_false_complete_fail(self):
        for target in ('duplicate', 'unknown', 'complete'):
            ledger = copy.deepcopy(self.ledger)
            if target == 'duplicate': ledger['requirements'].append(copy.deepcopy(ledger['requirements'][0]))
            elif target == 'unknown': ledger['requirements'][0]['acs'][0]['id'] = 'UDR-999-AC01'
            else: ledger['requirements'][0]['status'] = 'complete'
            self.assertTrue(self.check(ledger))

    def test_missing_evidence_out_of_range_and_escape_fail(self):
        for path, line in [('missing.py', 1), ('web/demo.js', 99), ('../escape.py', 1)]:
            ledger = copy.deepcopy(self.ledger)
            ledger['requirements'][0]['acs'][0]['evidence'] = [{'path': path, 'line': line, 'note': 'bad'}]
            self.assertTrue(self.check(ledger))

    def test_spec_drift_and_missing_report_entry_fail(self):
        self.assertTrue(self.check(report='### UDR-001：fixture'))
        source = self.root / next(iter(self.ledger['inputs']))
        source.write_text(source.read_text() + '\nchanged\n', encoding='utf-8')
        self.assertTrue(self.check())

    def test_historical_audit_uses_pinned_git_sources_after_later_changes(self):
        subprocess.run(['git', 'init', '-q', str(self.root)], check=True)
        subprocess.run(['git', '-C', str(self.root), 'add', '.'], check=True)
        subprocess.run(['git', '-C', str(self.root), '-c', 'user.name=Audit Fixture',
                        '-c', 'user.email=audit@example.test', 'commit', '-qm', 'fixture'], check=True)
        self.ledger['baseline'] = subprocess.check_output(
            ['git', '-C', str(self.root), 'rev-parse', 'HEAD'], text=True).strip()
        (self.root / 'web/demo.js').write_text('later code\n', encoding='utf-8')
        (self.root / next(iter(self.ledger['inputs']))).write_text('# later spec\n', encoding='utf-8')
        self.assertEqual(self.check(), [])

    def test_real_report_is_complete_and_evidence_paths_resolve(self):
        root = Path(__file__).resolve().parents[1]
        ledger = json.loads((root / 'docs/reviews/2026-10-23-requirements-audit.json').read_text('utf-8'))
        report = (root / 'docs/reviews/2026-10-23-adversarial-requirements-audit.md').read_text('utf-8')
        self.assertEqual(validate_audit(ledger, root, report), [])


if __name__ == '__main__':
    unittest.main()
