"""Check the lean design's contract and examples, not future UI acceptance."""
import copy
import json
import math
from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parents[1]
SPEC = ROOT / 'docs/requirements/2026-10-21-engineering-capability-dashboard.md'


def finite_duration(value):
    return type(value) in (int, float) and math.isfinite(value) and value >= 0


def quantile(values, q):
    ordered = sorted(values)
    if not ordered:
        return None
    position = (len(ordered) - 1) * q
    low, high = math.floor(position), math.ceil(position)
    return ordered[low] + (ordered[high] - ordered[low]) * (position - low)


def contract_from(text):
    blocks = re.findall(r'^```json\s*\n(.*?)^```\s*$', text, re.M | re.S)
    assert len(blocks) == 1, 'one reviewable contract required'
    return json.loads(blocks[0])


def triton_samples(batches):
    terminal = [b for b in batches if b['status'] in ('success', 'failure')]
    e2e = [b['duration_seconds'] for b in terminal
           if b['pr'] is not None and b['e2e_sample_eligible']
           and finite_duration(b['duration_seconds'])]
    npu = [b['npu_queue_seconds'] for b in terminal
           if not b['npu_data_missing'] and finite_duration(b['npu_queue_seconds'])]
    return e2e, npu


def validate_contract(contract):
    assert contract['status'] == 'proposal_not_implemented'
    assert [(x['id'], x['label'], x['entry']) for x in contract['sidebar']] == [
        ('ubs', 'UBSCore', '#projects/ubs/overview'),
        ('triton', 'Triton-Ascend', '#projects/triton/engineering')]
    assert set(contract['canonical_pages']) == {
        'ubs-overview', 'ubs-engineering', 'triton-engineering'}
    assert len(contract['canonical_pages']) == 3
    assert set(contract['retired_pages']) == {'workbench', 'quality', 'collection', 'method'}
    assert set(contract['merged_tasks']) == {'trends', 'records'}
    assert contract['primary_metrics'] == [
        'ubs_representative_e2e', 'triton_batch_e2e', 'triton_npu_max_queue']
    assert contract['metrics_by_page'] == {
        'ubs-overview': ['ubs_representative_e2e'],
        'ubs-engineering': ['ubs_representative_e2e'],
        'triton-engineering': ['triton_batch_e2e', 'triton_npu_max_queue']}
    assert contract['max_charts_per_workspace'] == 2
    assert contract['record_lists_per_workspace'] == 1

    ubs = contract['ubs_sample']
    representatives = []
    all_ids = []
    for pr in ubs['prs']:
        candidates = [b['e2e_ms'] for b in pr['batches']
                      if b['eligible'] and finite_duration(b['e2e_ms'])]
        if candidates:
            representatives.append(max(candidates))
        all_ids.extend(b['id'] for b in pr['batches'])
    assert len(all_ids) == len(set(all_ids))
    assert len({p['id'] for p in ubs['prs']}) == len(ubs['prs'])
    expected = ubs['expected']
    assert len(ubs['prs']) == expected['pr_count']
    assert len(representatives) == expected['e2e_valid']
    assert quantile(representatives, .5) == expected['p50_ms']
    assert quantile(representatives, .9) == expected['p90_ms']

    triton = contract['triton_sample']
    assert len({b['id'] for b in triton['batches']}) == len(triton['batches'])
    e2e, npu = triton_samples(triton['batches'])
    expected = triton['expected']
    assert len(e2e) == expected['e2e_valid']
    assert len(npu) == expected['npu_valid']
    assert quantile(e2e, .5) == expected['p50_seconds']
    assert quantile(e2e, .9) == expected['p90_seconds']
    assert quantile(npu, .5) == expected['npu_p50_seconds']
    assert quantile(npu, .9) == expected['npu_p90_seconds']


class EngineeringCapabilitySpecificationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.text = SPEC.read_text(encoding='utf-8')
        cls.contract = contract_from(cls.text)

    def test_lean_navigation_metric_budget_and_sample_arithmetic(self):
        validate_contract(self.contract)

    def test_each_requirement_has_unique_acceptance_and_verification(self):
        sections = list(re.finditer(
            r'^### (EC-\d{3})：[^\n]+\n(.*?)(?=^### EC-|^## |\Z)',
            self.text, re.M | re.S))
        self.assertEqual([m[1] for m in sections], [f'EC-{i:03d}' for i in range(1, 13)])
        all_acs = []
        for match in sections:
            key, body = match[1], match[2]
            with self.subTest(requirement=key):
                self.assertIn('**需求：**', body)
                self.assertIn('**验证：**', body)
                acs = re.findall(r'^- (' + key + r'-AC\d{2})：(.+)$', body, re.M)
                self.assertGreaterEqual(len(acs), 2)
                self.assertTrue(all(len(condition) > 40 for _, condition in acs))
                all_acs.extend(key for key, _ in acs)
        self.assertEqual(len(all_acs), len(set(all_acs)))

    def test_local_design_and_source_links_exist(self):
        for target in re.findall(r'\]\(([^)]+)\)', self.text):
            if '://' not in target:
                self.assertTrue((SPEC.parent / target.split('#')[0]).is_file(), target)

    def test_npu_missingness_does_not_change_e2e_eligibility(self):
        rows = copy.deepcopy(self.contract['triton_sample']['batches'])
        before_e2e, before_npu = triton_samples(rows)
        next(b for b in rows if b['id'] == 'T2')['npu_data_missing'] = True
        after_e2e, after_npu = triton_samples(rows)
        self.assertEqual(after_e2e, before_e2e)
        self.assertNotEqual(after_npu, before_npu)
        self.assertEqual((len(after_npu), quantile(after_npu, .5), quantile(after_npu, .9)),
                         (2, 30, 54))
        self.assertIn(0, before_e2e)
        self.assertIn(0, before_npu)
        rows = copy.deepcopy(self.contract['triton_sample']['batches'])
        next(b for b in rows if b['id'] == 'T2')['duration_seconds'] = None
        e2e_without_duration, npu_with_evidence = triton_samples(rows)
        self.assertEqual(e2e_without_duration, [0])
        self.assertEqual(npu_with_evidence, before_npu)

    def test_contract_rejects_extra_menu_duplicate_page_wrong_metric_and_arithmetic(self):
        mutations = []
        changed = copy.deepcopy(self.contract)
        changed['sidebar'].append({'id': 'quality', 'label': '数据质量', 'entry': '#quality'})
        mutations.append(changed)
        changed = copy.deepcopy(self.contract)
        changed['canonical_pages'].append('ubs-engineering')
        mutations.append(changed)
        changed = copy.deepcopy(self.contract)
        changed['metrics_by_page']['ubs-engineering'].append('triton_npu_max_queue')
        mutations.append(changed)
        changed = copy.deepcopy(self.contract)
        changed['ubs_sample']['expected']['p90_ms'] = 30000
        mutations.append(changed)
        changed = copy.deepcopy(self.contract)
        changed['triton_sample']['expected']['npu_valid'] = 2
        mutations.append(changed)
        for changed in mutations:
            with self.subTest(mutation=changed):
                with self.assertRaises(AssertionError):
                    validate_contract(changed)

    def test_legacy_migration_scope_and_truthful_delivery_are_explicit(self):
        for token in ('#workbench', '#ubs/repo/{repo}', '#repo/{repo}', '#quality', '#method',
                      '#overview', '#prs', 'replaceState', 'UDR-015', 'UAR-017',
                      '完整性/触发类别', '时间未知(n)', '待实施/待验收',
                      '文档测试通过不等于页面改造验收通过', '业务实现尚未开始',
                      '不扩大为大而全平台', 'required_status_checks',
                      'required_pull_request_reviews', 'Dashboard quality gate'):
            with self.subTest(token=token):
                self.assertIn(token, self.text)

    def test_no_observation_is_not_zero_and_profiles_are_not_ranked(self):
        self.assertIsNone(quantile([], .9))
        self.assertEqual(quantile([0], .5), 0)
        for invalid in (None, '', '0', -1, float('nan'), float('inf'), True):
            self.assertFalse(finite_duration(invalid), repr(invalid))
        self.assertIn('禁止跨社区混算E2E', self.text)
        self.assertIn('不能平均各仓P90/P50', self.text)
        self.assertIn('不称为“今天新增PR”', self.text)


if __name__ == '__main__':
    unittest.main()
