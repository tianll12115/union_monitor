"""Audit/spec verification only; these tests do not implement the future sort."""
import ast
import copy
from datetime import datetime
import json
import math
from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parents[1]
SPEC = ROOT / 'docs/requirements/2026-10-22-pr-submission-sort-and-quality-gate.md'
EVIDENCE = ROOT / 'audit/2026-10-22/pr-submission-gate-review'


def iso_ms(value):
    if value is None:
        return None
    parsed = datetime.fromisoformat(value.replace('Z', '+00:00'))
    assert parsed.utcoffset() is not None, 'timezone required'
    return round(parsed.timestamp() * 1000)


def valid_ms(value, cutoff):
    return (type(value) in (int, float) and math.isfinite(value)
            and value == int(value) and 0 <= value <= min(cutoff, 2**53 - 1))


def observed_code_time(pr, cutoff):
    # Independent interpretation of the written source/fixture contract.
    allowed = {('create', 'PR.created_at'), ('push', 'operate_logs')}
    candidates = []
    for event in pr.get('events', []):
        if (event.get('kind'), event.get('source')) not in allowed:
            continue
        value = event.get('time_ms') if 'time_ms' in event else iso_ms(event.get('at'))
        if valid_ms(value, cutoff):
            candidates.append(value)
    return max(candidates, default=None)


def sort_value(pr, cutoff):
    # Fixture defaults to the legacy-observed path, not a fourth persisted status.
    if pr.get('submission_events_status') in ('partial', 'unknown'):
        return None
    return observed_code_time(pr, cutoff)


def reference_order(prs, cutoff):
    def key(pr):
        value = sort_value(pr, cutoff)
        return (value is None, -value if value is not None else 0,
                -pr['pr'], pr.get('identity', str(pr['pr'])))
    return [pr['pr'] for pr in sorted(prs, key=key)]


def load_contract(text):
    blocks = re.findall(r'^```json\s*\n(.*?)^```\s*$', text, re.M | re.S)
    assert len(blocks) == 1
    return json.loads(blocks[0])


def validate_contract(contract):
    assert contract['status'] == 'specification_not_implemented'
    assert contract['fixture_origin'] == 'legacy-observed-events'
    assert contract['time_profile'] == 'ubs-latest-code-submission-v1'
    assert contract['sort_key'] == 'submitted'
    assert contract['legacy_sort_alias'] == 'created'
    assert set(contract['exclude_event_kinds']) == {'retest', 'note', 'comment'}
    assert contract['required_basic_ids'] == [f'BASIC-{i:03d}' for i in range(1, 13)]
    assert set(contract['required_jobs']) == {
        'python-tests', 'frontend-tests', 'collector-contracts', 'workflow-lint'}
    assert len(contract['required_jobs']) == 4
    cases, cutoff = contract['cases'], iso_ms(contract['cutoff'])
    assert len({pr['pr'] for pr in cases}) == len(cases)
    assert reference_order(cases, cutoff) == contract['expected_order']
    created_order = [pr['pr'] for pr in sorted(cases, key=lambda pr: (
        pr['created'] is None, -(iso_ms(pr['created']) or 0), -pr['pr']))]
    assert created_order == contract['expected_created_order']
    assert created_order != contract['expected_order'], 'fixture must distinguish old code'


class PRSubmissionGateSpecificationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.text = SPEC.read_text(encoding='utf-8')
        cls.contract = load_contract(cls.text)
        cls.gate = json.loads((EVIDENCE / 'gate-coverage-evidence.json').read_text(encoding='utf-8-sig'))
        cls.time = json.loads((EVIDENCE / 'submission-time-evidence.json').read_text(encoding='utf-8-sig'))

    def test_example_proves_submission_order_differs_from_creation(self):
        validate_contract(self.contract)

    def test_reruns_unlinked_push_and_future_times_have_distinct_effects(self):
        cutoff = iso_ms(self.contract['cutoff'])
        rows = copy.deepcopy(self.contract['cases'])
        target = next(pr for pr in rows if pr['pr'] == 101)
        self.assertEqual(observed_code_time(target, cutoff),
                         iso_ms('2026-10-22T08:30:00+08:00'))
        target['events'].append({'id': 'future', 'kind': 'push', 'source': 'operate_logs',
                                 'at': '2026-10-22T09:01:00+08:00'})
        self.assertEqual(reference_order(rows, cutoff), self.contract['expected_order'])
        unlinked = next(pr for pr in rows if pr['pr'] == 103)
        self.assertEqual(unlinked['events'][-1]['batch_urls'], [])
        self.assertEqual(observed_code_time(unlinked, cutoff),
                         iso_ms('2026-10-22T08:55:00+08:00'))

    def test_partial_and_created_only_do_not_fabricate_latest_submission(self):
        cutoff = iso_ms(self.contract['cutoff'])
        pr = copy.deepcopy(self.contract['cases'][0])
        pr['submission_events_status'] = 'partial'
        self.assertIsNone(sort_value(pr, cutoff))
        self.assertIsNotNone(observed_code_time(pr, cutoff))
        self.assertIsNone(sort_value({'pr': 200, 'created_ms': cutoff, 'events': []}, cutoff))
        self.assertIn('submission_time_origin', self.text)
        self.assertIn('legacy-observed', self.text)
        self.assertIn('新格式unknown/partial', self.text)

    def test_zero_unknown_invalid_and_pagination_are_not_conflated(self):
        cutoff = iso_ms(self.contract['cutoff'])
        for invalid in (None, '', '0', False, -1, .1, float('nan'), float('inf'), cutoff + 1):
            self.assertFalse(valid_ms(invalid, cutoff), repr(invalid))
        zero = {'pr': 1, 'events': [{'kind': 'create', 'source': 'PR.created_at', 'time_ms': 0}]}
        unknown = {'pr': 2, 'events': []}
        self.assertEqual(reference_order([unknown, zero], cutoff), [1, 2])
        for total in (0, 1, 15, 16, 30, 31):
            rows = [{'pr': i + 1, 'events': [{'kind': 'push', 'source': 'operate_logs',
                     'time_ms': i}]} for i in range(total)]
            order = reference_order(rows, cutoff)
            for size in (15, 30, 50):
                with self.subTest(total=total, page_size=size):
                    pages = [order[start:start + size] for start in range(0, total, size)]
                    merged = [value for page in pages for value in page]
                    self.assertEqual(merged, list(range(total, 0, -1)))
                    self.assertEqual(len(merged), len(set(merged)))

    def test_requirements_basic_journeys_and_faults_are_unique_and_complete(self):
        items = list(re.finditer(r'^### (PSG-\d{3})：[^\n]+\n(.*?)(?=^### PSG-|^## |\Z)',
                                 self.text, re.M | re.S))
        self.assertEqual([m[1] for m in items], [f'PSG-{i:03d}' for i in range(1, 8)])
        for item in items:
            key, block = item[1], item[2]
            self.assertIn('**需求：**', block)
            self.assertIn('**验证：**', block)
            acs = re.findall(r'^- (' + key + r'-AC\d{2})：(.+)$', block, re.M)
            self.assertGreaterEqual(len(acs), 2)
            self.assertEqual(len(acs), len({key for key, _ in acs}))
            self.assertTrue(all(len(condition) > 35 for _, condition in acs))
        self.assertEqual(re.findall(r'^\| (BASIC-\d{3}) \|', self.text, re.M),
                         self.contract['required_basic_ids'])
        self.assertEqual(re.findall(r'^\| (MUT-\d{3}) \|', self.text, re.M),
                         [f'MUT-{i:03d}' for i in range(1, 13)])

    def test_audit_evidence_is_bound_to_baseline_and_preserves_execution_limits(self):
        baseline = self.time['baseline_sha']
        self.assertEqual(baseline, self.gate['baseline']['commit'])
        self.assertIn(baseline, self.text)
        inventory = self.gate['browser_inventory']
        self.assertEqual(inventory['declared_test_count'],
                         sum(file['test_count'] for file in inventory['files']))
        self.assertEqual(inventory['spec_file_count'], len(inventory['files']))
        for result in self.gate['observed_test_results']:
            self.assertEqual(result['total'], result['passed'])
            self.assertEqual(result['failed'], 0)
        fault = self.gate['read_only_fault_injection']
        self.assertTrue(fault['observed']['contract_accepts_mutation'])
        self.assertIn('npm run test:browser', fault['mutation']['old'])
        self.assertIn('echo', fault['mutation']['new'])
        ast.parse(fault['replay']['python_code'])
        self.assertFalse(self.gate['scope']['external_branch_protection_state_verified'])

    def test_links_and_required_truthful_delivery_statements(self):
        for target in re.findall(r'\]\(([^)]+)\)', self.text):
            if '://' not in target:
                self.assertTrue((SPEC.parent / target.split('#')[0]).is_file(), target)
        for statement in ('排除重跑', '文档校验通过不等于业务实现通过',
                          '业务验收均为待实施/待验证', '不是当前工作流省略了浏览器执行',
                          '本次不把UBS时间窗和趋势横轴改成提交时间', 'forbidOnly',
                          'required_status_checks', 'required_pull_request_reviews'):
            self.assertIn(statement, self.text)

    def test_contract_rejects_old_order_missing_basic_and_weakened_pipeline(self):
        changes = []
        changed = copy.deepcopy(self.contract)
        changed['expected_order'] = changed['expected_created_order']
        changes.append(changed)
        changed = copy.deepcopy(self.contract)
        changed['required_basic_ids'].pop()
        changes.append(changed)
        changed = copy.deepcopy(self.contract)
        changed['required_jobs'].remove('frontend-tests')
        changes.append(changed)
        for changed in changes:
            with self.subTest(mutation=changed):
                with self.assertRaises(AssertionError):
                    validate_contract(changed)


if __name__ == '__main__':
    unittest.main()
