import copy
import json
import unittest
from pathlib import Path

from triton.dashboard import build_payload
from triton.quality import validate


def source(number=1, name='Integration Tests', **changes):
    row = dict(id=number, name=name, workflow_id=241783889 if name == 'Integration Tests' else 1,
               path='.github/workflows/ci.yml' if name == 'Integration Tests' else '.github/workflows/label.yml',
               pr=2280, pr_title='Example', pr_url='https://github.com/example/pull/2280',
               head_sha='abc', base_branch='main', run_attempt=1, created_at='2026-10-26T04:27:22Z',
               run_started_at='2026-10-26T04:27:22Z', updated_at='2026-10-26T04:52:59Z',
               status='completed', conclusion='success', jobs_complete=True,
               html_url=f'https://github.com/example/actions/runs/{number}',
               jobs=[dict(id=number * 10, name='test', status='completed', conclusion='success',
                          created_at='2026-10-26T04:27:22Z', started_at='2026-10-26T04:28:00Z',
                          completed_at='2026-10-26T04:52:58Z')])
    row.update(changes)
    return row


def payload(rows):
    return build_payload(rows, '2026-10-26T00:00:00Z', '2026-10-28T08:00:00Z', '2026-10-28T08:01:00Z')


class RunE2ETests(unittest.TestCase):
    def test_pr2280_frozen_upstream_runs_reconcile_to_actual_jobs(self):
        rows=json.loads((Path(__file__).parent/'fixtures/pr2280-e2e.json').read_text(encoding='utf8'))
        data=payload(rows)
        samples=[b for b in data['batches'] if b['e2e_sample_eligible']]
        self.assertEqual(len(samples),1)
        self.assertEqual(samples[0]['duration_seconds'],1536)
        self.assertEqual(samples[0]['end_at'],'2026-10-26T04:52:58Z')
        self.assertTrue(samples[0]['action_url'].endswith('/40269159120/attempts/1'))
        self.assertTrue(validate(rows,data)['passed'])

    def test_late_label_run_never_extends_integration_tests(self):
        rows = [source(), source(2, 'Auto labeling', created_at='2026-10-28T04:29:41Z',
                                 updated_at='2026-10-28T04:29:50Z', jobs=[])]
        data = payload(rows)
        self.assertEqual(data.get('e2e_metric_version'), 2)
        self.assertEqual(len(data['batches']), 2)
        measured = next(b for b in data['batches'] if b['e2e_sample_eligible'])
        self.assertEqual(measured['duration_seconds'], 1536)
        self.assertEqual(measured['end_at'], '2026-10-26T04:52:58Z')
        self.assertEqual(measured['action_url'], rows[0]['html_url']+'/attempts/1')
        self.assertEqual(measured['e2e_total'],1)
        self.assertEqual(data['summary']['valid'], 1)

    def test_independent_runs_on_same_sha_remain_independent_samples(self):
        data = payload([source(), source(2)])
        self.assertEqual(len(data['batches']), 2)
        self.assertEqual(data['summary']['valid'], 2)
        self.assertEqual(len({b['id'] for b in data['batches']}), 2)

    def test_missing_job_end_cannot_fall_back_to_updated_at(self):
        for changes in [dict(jobs=[]), dict(jobs_complete=False),
                        dict(jobs=[dict(id=10, status='completed', completed_at=None)])]:
            with self.subTest(changes=changes):
                b = payload([source(**changes)])['batches'][0]
                self.assertIsNone(b['duration_seconds'])
                self.assertFalse(b['e2e_sample_eligible'])

    def test_auxiliary_workflow_is_preserved_but_not_an_e2e_sample(self):
        b = payload([source(name='Auto labeling')])['batches'][0]
        self.assertFalse(b['e2e_sample_eligible'])
        self.assertEqual(b['e2e_exclusion_reason'], 'outside_integration_tests')

    def test_rerun_does_not_bill_gap_and_discloses_unknown_queue_start(self):
        row = source(run_attempt=2, run_started_at='2026-10-26T04:40:00Z')
        row['jobs'][0]['started_at'] = '2026-10-26T04:40:00Z'
        b = payload([row])['batches'][0]
        self.assertEqual(b['duration_seconds'], 778)
        self.assertFalse(b['e2e_sample_eligible'])
        self.assertEqual(b['e2e_exclusion_reason'], 'rerun_queue_start_unknown')

    def test_quality_gate_rejects_wrong_source_link_and_forged_duration(self):
        rows = [source()]
        data = payload(rows)
        self.assertTrue(validate(rows, data)['passed'])
        for field, value in [('action_url', 'https://github.com/example/actions/runs/999'),
                             ('end_at', '2026-10-28T04:29:50Z'), ('duration_seconds', 172949),
                             ('e2e_sample_eligible', False)]:
            with self.subTest(field=field):
                forged = copy.deepcopy(data)
                forged['batches'][0][field] = value
                self.assertFalse(validate(rows, forged)['passed'])

    def test_running_cancelled_unknown_and_wrong_workflow_never_enter_samples(self):
        cases=[dict(status='in_progress',conclusion=None),dict(conclusion='cancelled'),
               dict(pr=None),dict(workflow_id=99),dict(path='.github/workflows/other.yml')]
        for changes in cases:
            with self.subTest(changes=changes):
                row=source(**changes);data=payload([row]);b=data['batches'][0]
                self.assertFalse(b['e2e_sample_eligible'])
                if changes.get('status')=='in_progress':
                    self.assertIsNone(b['end_at'])
                    self.assertEqual(b['duration_seconds'],185558)
                self.assertTrue(validate([row],data)['passed'])

    def test_skipped_jobs_without_timestamps_do_not_erase_completed_evidence(self):
        row=source();row['jobs'].append(dict(id=19,status='completed',conclusion='skipped'))
        self.assertEqual(payload([row])['batches'][0]['duration_seconds'],1536)

    def test_inverted_and_future_jobs_never_make_completed_samples(self):
        for end in ['2026-10-26T04:27:00Z','2026-10-29T04:52:58Z']:
            row=source();row['jobs'][0]['completed_at']=end
            self.assertIsNone(payload([row])['batches'][0]['duration_seconds'])

    def test_duplicate_identity_is_idempotent_and_window_uses_each_run_start(self):
        old=source(2,created_at='2026-10-25T00:00:00Z')
        future=source(3,created_at='2026-10-29T00:00:00Z')
        data=payload([source(),source(),old,future])
        self.assertEqual([b['id'] for b in data['batches']],['run-1-attempt-1'])

    def test_historical_rerun_discloses_first_job_start_origin(self):
        row=source(run_attempt=2,attempt_source='enumerated')
        b=payload([row])['batches'][0]
        self.assertEqual(b['start_source'],'first_job_created')
        self.assertFalse(b['e2e_sample_eligible'])
        self.assertEqual(b['action_url'],row['html_url']+'/attempts/2')


if __name__ == '__main__':
    unittest.main()
