"""Validate this audit's traceability and arithmetic, not product acceptance."""
import ast
import json
from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parents[1]
DOC = ROOT / 'docs/requirements/2026-10-21-dashboard-user-audit.md'
EVIDENCE = ROOT / 'audit/2026-10-21/evidence'


def validate_spec(text):
    items = list(re.finditer(
        r'^### (UAR-\d{3})：[^\n]+\n(.*?)(?=^### UAR-|^## |\Z)',
        text, re.M | re.S))
    ids = [m[1] for m in items]
    assert ids == [f'UAR-{n:03d}' for n in range(1, 21)], ids
    for match in items:
        key, body = match[1], match[2]
        for label in ('**问题与影响：**', '**需求要求：**', '**验收标准：**', '**测试设计：**'):
            assert label in body, (key, label)
        acs = re.findall(r'^- (' + key + r'-AC\d{2})：(.+)$', body, re.M)
        assert len(acs) >= 2, key
        assert len(acs) == len({ac[0] for ac in acs}), key
        assert all(len(condition) > 35 for _, condition in acs), key
        assert re.search(r'\| ' + key + r' \| P[12] \|', text), key
    for target in re.findall(r'\]\(([^)]+)\)', text):
        if '://' not in target:
            assert (DOC.parent / target.split('#')[0]).is_file(), target
    for boundary in ('文档校验通过不等于业务验收通过', '未修改看板业务实现',
                     '不能据此报“漏采 7 个”', '没有获得可审阅截图',
                     '未穷举', '待实施', 'required_status_checks',
                     'required_pull_request_reviews', 'Dashboard quality gate'):
        assert boundary in text, boundary
    return items


class UserAuditSpecificationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.text = DOC.read_text(encoding='utf-8')
        cls.ubs = json.loads((EVIDENCE / 'ubs-data-audit.json').read_text(encoding='utf-8-sig'))
        cls.triton = json.loads((EVIDENCE / 'triton-data-audit.json').read_text(encoding='utf-8-sig'))
        cls.cross = json.loads((EVIDENCE / 'cross-page-audit.json').read_text(encoding='utf-8-sig'))

    def test_spec_has_unique_requirements_actionable_acceptance_and_real_evidence(self):
        self.assertEqual(len(validate_spec(self.text)), 20)

    def test_spec_rejects_deleted_requirement_criterion_link_and_scope_limit(self):
        mutations = (
            self.text.replace('### UAR-002：', '### UAR-001：', 1),
            self.text.replace('**需求要求：**', '**已删除：**', 1),
            self.text.replace('- UAR-001-AC02：', '- UAR-001-AC01：', 1),
            self.text.replace('../../audit/2026-10-21/evidence/ubs-data-audit.json',
                              '../../audit/2026-10-21/evidence/missing.json', 1),
            self.text.replace('没有获得可审阅截图', '截图已验收'),
        )
        for mutated in mutations:
            with self.subTest(mutation=mutated[:100]):
                with self.assertRaises(AssertionError):
                    validate_spec(mutated)

    def test_ubs_sample_arithmetic_identity_and_link_window_are_consistent(self):
        totals = self.ubs['totals']
        rows = totals['per_pr']
        self.assertEqual(len(rows), totals['unique_pr_numbers'])
        self.assertEqual(len({r['pr'] for r in rows}), len(rows))
        self.assertEqual(sum(r['executions'] for r in rows), totals['execution_objects'])
        self.assertEqual(totals['execution_objects'], totals['unique_execution_urls'])
        self.assertEqual((totals['pr_objects'], totals['execution_objects']), (36, 107))
        self.assertEqual(next(r for r in rows if r['pr'] == 1627)['executions'], 9)
        for field in ('start_ms', 'end_ms'):
            self.assertIn(str(self.ubs['source'][field]), self.text)
        self.assertIn('997459', self.text)
        self.assertIn('16.62', self.text)

    def test_triton_same_cutoff_prs_and_batches_are_not_confused(self):
        snapshot = self.triton['site_counts_today_through_site_cutoff']
        counts = self.triton['new_pr_counts']
        self.assertEqual(snapshot['batches'], sum(snapshot['kind_counts'].values()))
        self.assertEqual(snapshot['involved_prs'], len(set(snapshot['pr_numbers'])))
        self.assertEqual((snapshot['batches'], snapshot['involved_prs']), (45, 22))
        self.assertEqual(counts['through_source_retrieval'],
                         counts['through_site_cutoff'] + counts['created_after_site_cutoff'])
        self.assertEqual(counts['through_site_cutoff'], 7)
        self.assertEqual(counts['before_site_cutoff_absent_public'], [])
        self.assertIn('新建PR（pr.created_at）', self.text)

    def test_reconciliation_preserves_page_completion_and_source_provenance(self):
        reconciliations = self.triton['same_cutoff_action_run_reconciliation']
        self.assertEqual({r['event'] for r in reconciliations},
                         {'pull_request', 'pull_request_target'})
        self.assertEqual(sum(r['unique_run_ids'] for r in reconciliations), 286)
        for result in reconciliations:
            self.assertTrue(result['pagination_complete'])
            self.assertEqual(result['total_count'], result['retrieved_count'])
            self.assertEqual(len(result['pages']), 2)
            for page in result['pages']:
                self.assertRegex(page['sha256_raw_bytes'], r'^[a-f0-9]{64}$')
                self.assertTrue(page['url'].startswith('https://api.github.com/'))
        self.assertIn('不能推广为完整72小时', self.text)

    def test_saved_public_sources_have_fingerprints_and_reproduction_code_parses(self):
        self.assertRegex(self.ubs['source']['raw_response_sha256'], r'^[a-f0-9]{64}$')
        self.assertRegex(self.triton['site_source']['sha256_raw_bytes'], r'^[a-f0-9]{64}$')
        ast.parse((EVIDENCE / 'triton-reproduction.txt').read_text(encoding='utf-8-sig'))
        for filename in ('ubs-initial-dom.txt', 'triton-dom.txt', 'ubs-reproduction.txt',
                         'cross-page-reproduction.cjs'):
            self.assertGreater((EVIDENCE / filename).stat().st_size, 100)

    def test_each_cross_page_finding_is_mapped_to_current_requirements(self):
        # Explicit mapping prevents an additional finding silently missing the spec.
        mapping = {
            'CP-01': 'UAR-008', 'CP-02': 'UAR-008', 'CP-03': 'UAR-003',
            'CP-04': 'UAR-006', 'CP-05': 'UAR-007', 'CP-06': 'UAR-005',
            'CP-07': 'UAR-018', 'CP-08': 'UAR-018', 'CP-09': 'UAR-015',
            'CP-10': 'UAR-019', 'CP-11': 'UAR-016', 'CP-12': 'UAR-008',
            'CP-13': 'UAR-017',
        }
        self.assertEqual(set(self.cross['requirement_mapping']), set(mapping))
        for requirement in mapping.values():
            self.assertIn('### ' + requirement + '：', self.text)


if __name__ == '__main__':
    unittest.main()
