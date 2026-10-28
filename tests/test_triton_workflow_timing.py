"""TS28-002/003/007: workflow timing and job-timestamp contracts.

These tests pin the source semantics the hover card and export rely on:
first-task wait = earliest job start - attempt origin, execution span =
max(completed) - min(started) as wall clock, inverted evidence stays null
with a named anomaly, and the qualification sidecar names the collector's
metric instead of a legacy alias.
"""
import unittest

from triton.dashboard import _job, build_payload, qualification_manifest, workflow_timing


def job(**overrides):
    base = dict(id=11, name='integration-tests-ascend (linux-aarch64-a3-800i-4, py3.10)',
                status='completed', conclusion='success',
                created_at='2026-10-28T00:00:00Z', started_at='2026-10-28T00:00:10Z',
                completed_at='2026-10-28T00:10:00Z', html_url='https://github.com/example/actions/runs/7/job/11',
                steps=[])
    base.update(overrides)
    return base


def workflow(**overrides):
    base = dict(id=7, name='Integration Tests', attempt=1, created_at='2026-10-28T00:00:00Z',
                status='completed', conclusion='success', url='https://github.com/example/actions/runs/7',
                jobs=[job()], jobs_complete=True)
    base.update(overrides)
    return base


class JobTimingTests(unittest.TestCase):
    def test_inverted_pair_is_null_and_explained_never_a_fake_zero(self):
        row = _job(job(started_at='2026-10-28T00:00:02Z', completed_at='2026-10-28T00:00:01Z'))
        self.assertIsNone(row['run_seconds'])
        self.assertEqual(row['wait_seconds'], 2)
        self.assertTrue(row['run_inverted'])
        self.assertIn('结束时间早于开始时间', row['measurement_error'])
        self.assertEqual(row['started_at'], '2026-10-28T00:00:02Z')
        self.assertEqual(row['completed_at'], '2026-10-28T00:00:01Z')

    def test_inverted_queue_start_keeps_the_raw_fields(self):
        row = _job(job(started_at='2026-10-27T23:59:50Z'))
        self.assertIsNone(row['wait_seconds'])
        self.assertTrue(row['wait_inverted'])
        self.assertIn('开始时间早于创建时间', row['measurement_error'])

    def test_zero_and_fractional_seconds_are_preserved(self):
        zero = _job(job(created_at='2026-10-28T00:00:00Z', started_at='2026-10-28T00:00:00Z',
                        completed_at='2026-10-28T00:00:00Z'))
        self.assertEqual(zero['wait_seconds'], 0)
        self.assertEqual(zero['run_seconds'], 0)
        fractional = _job(job(completed_at='2026-10-28T00:00:10.500Z'))
        self.assertEqual(fractional['wait_seconds'], 10)
        self.assertEqual(fractional['run_seconds'], 0.5)

    def test_skipped_job_keeps_its_source_shape(self):
        row = _job(job(conclusion='skipped', started_at=None, completed_at=None, status='completed'))
        self.assertIsNone(row['wait_seconds'])
        self.assertIsNone(row['run_seconds'])
        self.assertIsNone(row['measurement_error'])


class WorkflowTimingTests(unittest.TestCase):
    def test_first_task_wait_and_wall_clock_execution_span(self):
        other = job(id=12, name='integration-tests-ascend (linux-aarch64-a3-800i-4, py3.11)',
                    started_at='2026-10-28T00:00:20Z', completed_at='2026-10-28T00:12:00Z')
        timing = workflow_timing(workflow(jobs=[job(), other]), '2026-10-28T01:00:00Z')
        self.assertEqual(timing['first_job_wait_seconds'], 10)
        self.assertEqual(timing['execution_span_seconds'], 710)
        self.assertEqual(timing['attempt_origin_source'], 'workflow_created')
        self.assertTrue(timing['timing_complete'])
        self.assertIsNone(timing['timing_missing_reason'])
        self.assertEqual(timing['timing_measurement_kind'], 'workflow_wall_clock')

    def test_rerun_without_queue_origin_leaves_the_wait_empty(self):
        timing = workflow_timing(workflow(attempt=2, attempt_source=None), '2026-10-28T01:00:00Z')
        self.assertIsNone(timing['first_job_wait_seconds'])
        self.assertIsNone(timing['attempt_origin'])
        self.assertIn('重跑前置排队起点未知', timing['timing_missing_reason'])
        self.assertTrue(timing['timing_complete'], 'execution span still uses job timestamps')

    def test_enumerated_rerun_uses_the_first_job_creation_as_origin(self):
        rerun = workflow(attempt=2, attempt_source='enumerated', created_at='2026-10-27T23:00:00Z',
                         jobs=[job(created_at='2026-10-28T00:00:00Z')])
        timing = workflow_timing(rerun, '2026-10-28T01:00:00Z')
        self.assertEqual(timing['attempt_origin_source'], 'first_job_created')
        self.assertEqual(timing['first_job_wait_seconds'], 10)

    def test_incomplete_job_pagination_never_claims_a_span(self):
        timing = workflow_timing(workflow(jobs_complete=False), '2026-10-28T01:00:00Z')
        self.assertIsNone(timing['execution_span_seconds'])
        self.assertFalse(timing['timing_complete'])
        self.assertIn('job 分页不完整', timing['timing_missing_reason'])

    def test_skipped_only_workflow_has_no_timing_instead_of_zero(self):
        timing = workflow_timing(workflow(jobs=[job(conclusion='skipped', started_at=None, completed_at=None)]),
                                 '2026-10-28T01:00:00Z')
        self.assertIsNone(timing['first_job_wait_seconds'])
        self.assertIsNone(timing['execution_span_seconds'])
        self.assertIn('无有效 job 明细', timing['timing_missing_reason'])

    def test_inverted_job_time_blocks_the_span_and_names_the_anomaly(self):
        bad = job(started_at='2026-10-28T00:05:00Z', completed_at='2026-10-28T00:04:00Z')
        timing = workflow_timing(workflow(jobs=[bad]), '2026-10-28T01:00:00Z')
        self.assertIsNone(timing['execution_span_seconds'])
        self.assertIn('执行跨度仅截至采集观测', timing['timing_missing_reason'])

    def test_running_workflow_does_not_fabricate_a_completed_span(self):
        running = workflow(status='in_progress', conclusion=None,
                          jobs=[job(completed_at=None, status='in_progress')])
        timing = workflow_timing(running, '2026-10-28T01:00:00Z')
        self.assertIsNone(timing['execution_span_seconds'])
        self.assertEqual(timing['first_job_wait_seconds'], 10)
        self.assertIn('尚未全部完成', timing['timing_missing_reason'])


class PublishedPayloadTests(unittest.TestCase):
    def run_row(self, **overrides):
        base = dict(id=7, run_attempt=1, name='Integration Tests', status='completed', conclusion='success',
                    created_at='2026-10-28T00:00:00Z', updated_at='2026-10-28T00:10:00Z',
                    run_started_at='2026-10-28T00:00:00Z',
                    html_url='https://github.com/triton-lang/triton-ascend/actions/runs/7',
                    pr=42, pr_url='https://github.com/triton-lang/triton-ascend/pull/42',
                    head_sha='a' * 40, workflow_id=241783889, path='.github/workflows/ci.yml',
                    event='pull_request', jobs_complete=True, jobs=[job()])
        base.update(overrides)
        return base

    def test_payload_carries_the_timing_contract_on_each_workflow(self):
        payload = build_payload([self.run_row()], '2026-10-27T00:00:00Z', '2026-10-28T02:00:00Z',
                                '2026-10-28T02:00:00Z', fetch_start='2026-10-27T00:00:00Z',
                                fetch_end='2026-10-28T01:30:00Z')
        wf = payload['batches'][0]['workflows'][0]
        self.assertEqual(wf['first_job_wait_seconds'], 10)
        self.assertEqual(wf['execution_span_seconds'], 590)
        self.assertEqual(wf['attempt_origin_source'], 'workflow_created')
        self.assertTrue(wf['timing_complete'])
        self.assertIn('timing_contract', payload)

    def test_qualification_manifest_uses_the_collector_metric_and_scope(self):
        payload = build_payload([self.run_row()], '2026-10-27T00:00:00Z', '2026-10-28T02:00:00Z',
                                '2026-10-28T02:00:00Z', fetch_start='2026-10-27T00:00:00Z',
                                fetch_end='2026-10-28T01:30:00Z')
        manifest = qualification_manifest(payload)
        self.assertEqual(manifest['metric'], 'integration_tests_workflow_e2e')
        self.assertEqual(manifest['metric_version'], 2)
        self.assertEqual(manifest['schema_version'], 1)
        self.assertEqual(manifest['discovery_fetch_window_end'], '2026-10-28T01:30:00Z')
        self.assertIn('boundary_note', manifest)

    def test_missing_metric_falls_back_to_the_current_metric_not_the_legacy_alias(self):
        manifest = qualification_manifest({'batches': [], 'collected_at': None})
        self.assertEqual(manifest['metric'], 'integration_tests_workflow_e2e')

    def test_qualification_rejects_an_inverted_job_and_keeps_e2e_empty(self):
        from triton.run_e2e import measurement
        row = dict(id=8, run_attempt=1, name='Integration Tests', status='completed', conclusion='success',
                   created_at='2026-10-28T00:00:00Z', updated_at='2026-10-28T00:20:00Z',
                   pr=42, head_sha='a' * 40, workflow_id=241783889, path='.github/workflows/ci.yml',
                   jobs_complete=True,
                   jobs=[job(started_at='2026-10-28T00:05:00Z', completed_at='2026-10-28T00:04:00Z')])
        evidence = measurement(row, '2026-10-28T02:00:00Z')
        self.assertIsNone(evidence['duration_seconds'])
        self.assertFalse(evidence['e2e_sample_eligible'])
        self.assertEqual(evidence['e2e_exclusion_reason'], 'invalid_or_missing_duration')
        payload = build_payload([row], '2026-10-27T00:00:00Z', '2026-10-28T02:00:00Z',
                                '2026-10-28T02:00:00Z')
        timing = payload['batches'][0]['workflows'][0]
        self.assertIsNone(timing['execution_span_seconds'])
        self.assertIn('执行跨度仅截至采集观测', timing['timing_missing_reason'])


if __name__ == '__main__':
    unittest.main()
