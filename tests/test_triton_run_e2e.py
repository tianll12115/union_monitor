import copy
import json
import unittest
from pathlib import Path

from triton.dashboard import build_payload, _job, summary_of
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
    def test_real_pr3097_source_preserves_queue_and_full_execution(self):
        row = json.loads((Path(__file__).parent/'fixtures/pr3097-source.json').read_text(encoding='utf-8'))
        data = build_payload([row], '2026-11-09T00:00:00Z', '2026-11-12T06:49:49Z', '2026-11-12T06:49:49Z')
        batch = data['batches'][0]
        self.assertTrue(batch['is_integration_tests'])
        self.assertEqual(batch['npu_queue_seconds'], 4208)
        # The 2.5-minute step skew is normal post-job teardown, so the measured
        # 89-minute E2E (queue + execution) is retained instead of discarded.
        self.assertEqual(batch['duration_seconds'], 5350)
        self.assertEqual(batch['end_at'], '2026-11-10T15:17:01Z')
        self.assertTrue(batch['e2e_sample_eligible'])
        self.assertEqual(data['summary']['valid'], 1)
        self.assertTrue(validate([row], data)['passed'])
        self.assertTrue(all(not j['timeline_conflict'] for j in batch['npu_jobs']))

    def test_run_completion_before_creation_is_quarantined_even_when_jobs_look_valid(self):
        row = source(updated_at='2026-10-25T00:00:00Z')
        data = payload([row])
        self.assertIsNone(data['batches'][0]['duration_seconds'])
        self.assertEqual(data['summary']['valid'], 0)
        self.assertTrue(validate([row], data)['passed'])

    def test_quality_checks_all_serialized_source_jobs_and_workflow_identity(self):
        rows = [source()]
        data = payload(rows)
        mutations = [lambda w: w.update(workflow_id=999), lambda w: w.update(path='ci.fake'),
                     lambda w: w.update(jobs=[]), lambda w: w['jobs'][0].update(run_seconds=0),
                     lambda w: w['jobs'][0].update(timeline_conflict=True),
                     lambda w: w['jobs'][0].update(wait_seconds=0),
                     lambda w: w['jobs'][0].update(name='invented job'),
                     lambda w: w['jobs'][0].update(url='https://example.com/wrong'),
                     lambda w: w['jobs'][0].update(failed_steps=['invented failure']),
                     lambda w: w['jobs'][0].update(measurement_error='invented anomaly'),
                     lambda w: w['jobs'][0].update(started_at='2026-10-26T04:27:22Z'),
                     lambda w: w['jobs'].append(copy.deepcopy(w['jobs'][0]))]
        for mutate in mutations:
            with self.subTest(mutation=mutate):
                changed = copy.deepcopy(data)
                mutate(changed['batches'][0]['workflows'][0])
                self.assertFalse(validate(rows, changed)['passed'])

    def test_boolean_zero_is_not_a_measured_source_job_time(self):
        row = source()
        row['jobs'][0]['started_at'] = row['jobs'][0]['created_at']
        data = payload([row])
        self.assertTrue(validate([row], data)['passed'])
        data['batches'][0]['workflows'][0]['jobs'][0]['wait_seconds'] = False
        self.assertFalse(validate([row], data)['passed'])

    def test_npu_source_membership_cannot_disappear_when_only_runner_identifies_chip(self):
        row = source()
        row['jobs'][0]['runner_name'] = 'linux-amd64-a5-2-runner-1'
        data = payload([row])
        self.assertTrue(validate([row], data)['passed'])
        self.assertEqual(len(data['batches'][0]['npu_jobs']), 1)
        data['batches'][0].update(npu_jobs=[], npu_queue_seconds=None)
        self.assertFalse(validate([row], data)['passed'])

    def test_terminal_results_are_not_relabelled_as_success_and_gate_checks_them(self):
        for conclusion, expected in [('skipped', 'skipped'), ('neutral', 'neutral'),
                                     (None, 'unknown'), ('future_result', 'unknown')]:
            with self.subTest(conclusion=conclusion):
                row = source(conclusion=conclusion)
                data = payload([row])
                self.assertEqual(data['batches'][0]['status'], expected)
                self.assertEqual(data['summary']['valid'], 0)
                self.assertTrue(validate([row], data)['passed'])
                forged = copy.deepcopy(data)
                forged['batches'][0]['status'] = 'success'
                self.assertFalse(validate([row], forged)['passed'])

    def test_steps_outside_job_timeline_quarantine_execution_and_e2e(self):
        for step in [dict(started_at='2026-10-26T04:29:00Z', completed_at='2026-10-26T04:58:30Z'),
                     dict(started_at='2026-10-26T04:22:00Z', completed_at='2026-10-26T04:30:00Z'),
                     dict(started_at='2026-10-26T04:30:00Z', completed_at='2026-10-26T04:29:00Z'),
                     dict(started_at='2026-10-26T04:58:30Z'),
                     dict(completed_at='2026-10-26T04:20:00Z')]:
            with self.subTest(step=step):
                row = source()
                row['jobs'][0]['steps'] = [step]
                job = _job(row['jobs'][0])
                self.assertIsNone(job['run_seconds'])
                self.assertIn('job/step', job['measurement_error'])
                self.assertEqual(job['wait_seconds'], 38)
                data = payload([row])
                self.assertIsNone(data['batches'][0]['duration_seconds'])
                self.assertEqual(data['batches'][0]['e2e_exclusion_reason'], 'source_timeline_conflict')
                self.assertIsNone(data['batches'][0]['workflows'][0]['execution_span_seconds'])
                self.assertTrue(validate([row], data)['passed'])

    def test_post_job_teardown_skew_within_allowance_keeps_the_measurement(self):
        # Observed on real runs: "Set up job" up to 35 s before started_at and
        # post-job steps up to 169 s after completed_at.
        row = source()
        row['jobs'][0]['steps'] = [dict(name='Set up job', started_at='2026-10-26T04:27:40Z',
                                       completed_at='2026-10-26T04:28:10Z'),
                                   dict(name='Complete job', started_at='2026-10-26T04:53:00Z',
                                        completed_at='2026-10-26T04:55:29Z')]
        job = _job(row['jobs'][0])
        self.assertFalse(job['timeline_conflict'])
        self.assertEqual(job['run_seconds'], 1498)
        data = payload([row])
        self.assertEqual(data['batches'][0]['duration_seconds'], 1536)
        self.assertTrue(data['batches'][0]['e2e_sample_eligible'])

    def test_running_timeline_conflict_is_quarantined_without_blocking_collection(self):
        row = source(status='in_progress', conclusion=None)
        row['jobs'][0]['steps'] = [dict(completed_at='2026-10-26T05:00:30Z')]
        data = payload([row])
        self.assertIsNone(data['batches'][0]['duration_seconds'])
        self.assertTrue(validate([row], data)['passed'])

    def test_out_of_window_future_attempt_does_not_invalidate_historical_window(self):
        rows = [source(), source(2, run_attempt=2, run_started_at='2026-10-29T00:00:00Z',
                                 updated_at='2026-10-29T01:00:00Z')]
        data = payload(rows)
        self.assertEqual(len(data['batches']), 1)
        self.assertTrue(validate(rows, data)['passed'])

    def test_valid_steps_preserve_job_measurement_and_auxiliary_flag_blocks_summary(self):
        row = source()
        row['jobs'][0]['steps'] = [dict(started_at='2026-10-26T04:28:00Z', completed_at='2026-10-26T04:52:58Z')]
        self.assertEqual(_job(row['jobs'][0])['run_seconds'], 1498)
        self.assertTrue(payload([row])['batches'][0]['e2e_sample_eligible'])
        self.assertEqual(summary_of([dict(pr=1, status='success', duration_seconds=10,
                                         is_integration_tests=False, approximate=False, missing=[])])['valid'], 0)

    def test_ascend_ci_is_a_real_integration_sample_and_validator_agrees(self):
        rows = [source(workflow_id=348219361, path='.github/workflows/ascend-ci.yml')]
        data = payload(rows)
        self.assertTrue(data['batches'][0]['is_integration_tests'])
        self.assertTrue(data['batches'][0]['e2e_sample_eligible'])
        self.assertEqual(data['summary']['valid'], 1)
        self.assertEqual(data['summary']['p90'], 1536)
        self.assertTrue(validate(rows, data)['passed'])
        forged = copy.deepcopy(data)
        forged['batches'][0]['e2e_sample_eligible'] = False
        self.assertFalse(validate(rows, forged)['passed'])

    def test_integration_scope_is_verified_by_path_but_identity_drift_still_fails(self):
        # A re-added workflow file keeps its path but gets a new numeric id; it
        # must stay in scope instead of silently disappearing from the E2E chart.
        rows = [source(workflow_id=999)]
        self.assertTrue(payload(rows)['batches'][0]['e2e_sample_eligible'])
        self.assertTrue(validate(rows, payload(rows))['passed'])
        for changes in [dict(workflow_id=348219361, path='.github/workflows/ci.yml'),
                        dict(workflow_id=241783889, path='.github/workflows/replacement.yml')]:
            with self.subTest(changes=changes):
                rows = [source(**changes)]
                report = validate(rows, payload(rows))
                self.assertFalse(report['passed'])
                self.assertTrue(any('workflow' in error for error in report['errors']),
                                report['errors'])
        rows = [source(workflow_id=241783889, path='.github/workflows/replacement.yml')]
        self.assertIn('unclassified Integration Tests workflow', ';'.join(validate(rows, payload(rows))['errors']))

    def test_renamed_registered_workflow_remains_identified_by_id_and_path(self):
        rows = [source(name='Renamed NPU CI', workflow_id=348219361,
                       path='.github/workflows/ascend-ci.yml@refs/heads/main')]
        self.assertTrue(payload(rows)['batches'][0]['e2e_sample_eligible'])
        self.assertTrue(validate(rows, payload(rows))['passed'])

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

    def test_unresolved_auxiliary_still_has_explicit_non_integration_scope(self):
        b=payload([source(name='Auto labeling',pr=None)])['batches'][0]
        self.assertIs(b.get('is_integration_tests'),False)
        self.assertFalse(b['e2e_sample_eligible'])

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
                             ('e2e_sample_eligible', False),('is_integration_tests',False)]:
            with self.subTest(field=field):
                forged = copy.deepcopy(data)
                forged['batches'][0][field] = value
                self.assertFalse(validate(rows, forged)['passed'])

    def test_ambiguous_identity_has_its_own_exclusion_reason(self):
        row = source(pr=None, pr_candidates=[3011, 3051])
        batch = payload([row])['batches'][0]
        self.assertFalse(batch['e2e_sample_eligible'])
        self.assertEqual(batch['e2e_exclusion_reason'], 'ambiguous_pr_batch_identity')
        self.assertEqual(batch['pr_candidates'], [3011, 3051])

    def test_running_cancelled_unknown_and_wrong_workflow_never_enter_samples(self):
        cases=[dict(status='in_progress',conclusion=None),dict(conclusion='cancelled'),
               dict(pr=None),dict(workflow_id=99,path='.github/workflows/other.yml')]
        for changes in cases:
            with self.subTest(changes=changes):
                row=source(**changes);data=payload([row]);b=data['batches'][0]
                self.assertFalse(b['e2e_sample_eligible'])
                if changes.get('status')=='in_progress':
                    self.assertIsNone(b['end_at'])
                    # An in-flight batch is observed until the collection time
                    # (08:01), not the selection cutoff (08:00).
                    self.assertEqual(b['duration_seconds'],185618)
                report = validate([row],data)
                if 'workflow_id' in changes or 'path' in changes:
                    self.assertFalse(report['passed'])
                else:
                    self.assertTrue(report['passed'])

    def test_skipped_jobs_without_timestamps_do_not_erase_completed_evidence(self):
        row=source();row['jobs'].append(dict(id=19,status='completed',conclusion='skipped'))
        self.assertEqual(payload([row])['batches'][0]['duration_seconds'],1536)

    def test_inverted_and_future_jobs_never_make_completed_samples(self):
        for end in ['2026-10-26T04:27:00Z','2026-10-29T04:52:58Z']:
            row=source();row['jobs'][0]['completed_at']=end
            self.assertIsNone(payload([row])['batches'][0]['duration_seconds'])

    def test_inverted_job_timestamps_quarantine_the_end_and_the_reason(self):
        # DQ-09: a job that ends before it starts proves nothing about when the
        # attempt finished, so the end stays empty instead of being borrowed.
        row=source();row['jobs'][0]['completed_at']='2026-10-26T04:27:30Z'
        b=payload([row])['batches'][0]
        self.assertIsNone(b['duration_seconds'])
        self.assertIsNone(b['end_at'])
        self.assertIsNone(b['end_source'])
        self.assertFalse(b['e2e_sample_eligible'])
        self.assertEqual(b['e2e_exclusion_reason'],'source_timestamp_inversion')
        self.assertIn('源时间戳倒置'," ".join(b['missing']))
        self.assertTrue(validate([row],payload([row]))['passed'])

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
