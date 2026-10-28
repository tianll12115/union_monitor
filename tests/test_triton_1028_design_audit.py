"""Regression protection for the independent design-audit calculations."""
import copy
import importlib.util
import gzip
import hashlib
import json
from pathlib import Path
import unittest

SPEC = importlib.util.spec_from_file_location('design_audit', Path(__file__).resolve().parents[1] /
    'docs/requirements/1028-new/audit_snapshot.py')
AUDIT = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(AUDIT)


def row():
    url = 'https://github.com/example/repo/actions/runs/1/attempts/1'
    return dict(id='run-1-attempt-1', start_at='2026-10-28T00:00:00Z',
                end_at='2026-10-28T00:01:00Z', duration_seconds=60, status='success',
                is_integration_tests=True, e2e_sample_eligible=True, npu_queue_seconds=0,
                action_url=url, workflows=[dict(id=1, attempt=1, url=url)])


def payload(rows=None):
    return dict(repo='example/repo', collected_at='2026-10-28T00:02:00Z',
                discovery={'fetch_window_end': '2026-10-28T00:01:00Z'},
                batches=[row()] if rows is None else rows)


class DesignAuditTests(unittest.TestCase):
    def check(self, p, sources=()):
        return AUDIT.audit(p, 1793145600000, 1793145720000, sources)

    def test_quantiles_empty_zero_and_interpolation(self):
        self.assertIsNone(AUDIT.quantile([], .9))
        self.assertEqual(AUDIT.quantile([0], .9), 0)
        self.assertEqual(AUDIT.quantile([100, 0], .9), 90)
        self.assertIsNone(AUDIT.stamp(None))

    def test_scope_excludes_unknown_time_auxiliary_and_ineligible_but_keeps_zero(self):
        rows = [row(), dict(row(), id='unknown', start_at=None, e2e_sample_eligible=False),
                dict(row(), id='aux', is_integration_tests=False, e2e_sample_eligible=False),
                dict(row(), id='rerun', e2e_sample_eligible=False, npu_queue_seconds=None),
                dict(row(), id='outside', start_at='2026-10-27T00:00:00Z', e2e_sample_eligible=False)]
        result = self.check(payload(rows))
        self.assertEqual(result['selected_integration_runs'], 2)
        self.assertEqual(result['e2e_samples'], 1)
        self.assertEqual(result['npu_samples'], 2)
        self.assertEqual(result['npu_p90_seconds'], 0)
        self.assertEqual(result['creation_discovery_gap_seconds'], 60)
        self.assertEqual(result['payload_issues'], [])

    def test_bad_identity_link_grain_eligibility_and_endpoints_are_reported(self):
        bad = row()
        bad.update(action_url='wrong', duration_seconds=99, is_integration_tests=False)
        bad['workflows'][0]['attempt'] = 2
        result = self.check(payload([bad, copy.deepcopy(bad)]))
        self.assertEqual({v['type'] for v in result['payload_issues']},
                         {'duplicate_identity', 'eligibility', 'source_url', 'endpoints'})

    def test_missing_timestamp_and_reversed_endpoints_do_not_pass(self):
        self.assertTrue(self.check(payload([dict(row(), end_at=None)]))['payload_issues'])
        self.assertTrue(self.check(payload([dict(row(), end_at='2026-10-27T00:00:00Z')]))['payload_issues'])

    def test_source_jobs_not_updated_at_control_expected_duration(self):
        source = dict(run=dict(id=1, run_attempt=1, created_at=row()['start_at'], updated_at='2099-01-01T00:00:00Z'),
                      jobs=dict(total_count=2, jobs=[dict(status='completed', conclusion='success', completed_at=row()['end_at']),
                                                    dict(status='completed', conclusion='skipped', completed_at=None)]))
        self.assertTrue(self.check(payload(), [source])['upstream_reconciliation'][0]['matches'])
        source['jobs']['total_count'] = 3
        self.assertFalse(self.check(payload(), [source])['upstream_reconciliation'][0]['matches'])
        source['jobs']['jobs'] = []
        self.assertFalse(self.check(payload([]), [source])['upstream_reconciliation'][0]['matches'])

    def test_empty_scope_without_discovery_remains_unknown(self):
        p = payload([])
        p.pop('discovery')
        result = self.check(p)
        self.assertEqual(result['e2e_samples'], 0)
        self.assertIsNone(result['e2e_p90_seconds'])
        self.assertIsNone(result['creation_discovery_gap_seconds'])

    def test_cancelled_job_inverted_time_is_not_a_measured_zero(self):
        batch = row()
        batch['workflows'][0]['jobs'] = [dict(id=7, conclusion='cancelled',
            started_at='2026-10-28T00:00:02Z', completed_at='2026-10-28T00:00:01Z', run_seconds=0)]
        result = AUDIT.job_duration_check(payload([batch]))
        self.assertEqual(result['jobs_checked'], 1)
        self.assertEqual(result['issues'][0]['expected_seconds'], -1)
        batch['workflows'][0]['jobs'][0]['completed_at'] = None
        self.assertEqual(AUDIT.job_duration_check(payload([batch]))['issues'], [])

    def test_frozen_published_bytes_match_original_fetch_hashes(self):
        root = Path(SPEC.origin).parent / 'evidence'
        for item in json.loads((root / 'fetch-index.json').read_text(encoding='utf8'))['files']:
            path = root / 'published' / item['path']
            raw = path.read_bytes() if path.exists() else gzip.decompress(path.with_suffix(path.suffix + '.gz').read_bytes())
            self.assertEqual(hashlib.sha256(raw).hexdigest(), item['sha256'], item['path'])

    def test_frozen_scope_and_upstream_reconciliation_remain_reproducible(self):
        root = Path(SPEC.origin).parent / 'evidence'
        data = json.loads(gzip.decompress((root / 'published/data/triton.json.gz').read_bytes()))
        sources = [dict(run=json.loads(path.read_text(encoding='utf8')),
                        jobs=json.loads(path.with_name(path.name.replace('-run', '-jobs')).read_text(encoding='utf8')))
                   for path in sorted((root / 'upstream').glob('*-run.json'))]
        result = self.check(data, sources)
        # The generic helper's scope is deliberately tiny; audit the actual user scope separately.
        self.assertEqual(result['e2e_samples'], 0)
        result = AUDIT.audit(data, 1793102506000, 1793188906000, sources)
        frozen = json.loads((root / 'audit-results.json').read_text(encoding='utf8'))
        for key, value in result.items():
            self.assertEqual(value, frozen[key], key)
        self.assertEqual(result['e2e_samples'], 84)
        self.assertEqual(result['npu_samples'], 101)
        self.assertEqual(len(result['upstream_reconciliation']), 4)
        self.assertTrue(all(row['matches'] for row in result['upstream_reconciliation']))
