"""UBS invalid timing evidence and collection-completeness regressions."""
import copy
import unittest
from pathlib import Path

from metrics import extract_events, match_event, measure_batch, normalize_job
from monitor.adapters.gitcode_jenkins import validate_snapshot
from monitor.catalog import Catalog
from monitor.context import RunContext, utc_time


def raw_job(**updates):
    row = dict(url='job/1/', number=1, timestamp=3000, duration=500,
               result='SUCCESS', actions=[dict(waitingTimeMillis=0,
               blockedTimeMillis=0, buildableTimeMillis=0)])
    row.update(updates)
    return row


class TimingIntegrityTests(unittest.TestCase):
    def test_invalid_execution_fields_cannot_create_measured_end_or_total(self):
        for field in ('timestamp', 'duration'):
            for invalid in (None, True, False, -1, float('nan'), float('inf'), '500'):
                with self.subTest(field=field, invalid=invalid):
                    job = normalize_job(raw_job(**{field: invalid}))
                    self.assertIsNone(job['end_ms'])
                    self.assertIsNone(job['total_ms'])
                    trigger = normalize_job(raw_job(timestamp=1000, duration=1000))
                    self.assertFalse(measure_batch(trigger, [job], 500, True)['eligible'])

    def test_invalid_request_or_terminal_job_evidence_is_excluded(self):
        job = normalize_job(raw_job())
        for invalid in (True, -1, float('nan'), float('inf'), '500'):
            with self.subTest(request=invalid):
                self.assertFalse(measure_batch(job, [job], invalid, True)['eligible'])
        for patch in ({'end_ms': 2999}, {'end_ms': float('inf')},
                      {'start_ms': None}, {'duration_ms': -1}, {'end_ms': None}):
            with self.subTest(patch=patch):
                child = dict(job, **patch)
                self.assertFalse(measure_batch(job, [child], 500, True)['eligible'])

    def test_zero_execution_and_queue_are_real_measurements(self):
        job = normalize_job(raw_job(timestamp=0, duration=0))
        self.assertEqual(job['start_ms'], 0)
        self.assertEqual(job['end_ms'], 0)
        self.assertEqual(job['total_ms'], 0)
        self.assertEqual(measure_batch(job, [job], 0, True)['e2e_ms'], 0)

    def test_running_job_never_gets_a_terminal_duration(self):
        job = normalize_job(raw_job(building=True))
        self.assertIsNone(job['duration_ms'])
        self.assertIsNone(job['end_ms'])
        self.assertFalse(measure_batch(job, [job], 500, True)['eligible'])


class EventIdentityIntegrityTests(unittest.TestCase):
    def test_extract_to_match_never_manufactures_identity_from_missing_source_ids(self):
        pr = dict(created_at='2026-10-01T00:00:00Z')
        for source_id in ({}, {'id': None}, {'id': ''}, {'id': False}):
            with self.subTest(source_id=source_id):
                comment = dict(source_id, body='/retest', created_at='2026-10-01T00:01:00Z')
                events = extract_events(pr, [], [comment])
                self.assertIsNone(events[-1]['id'])
                for value in ('None', '', 'False', None):
                    self.assertIsNone(match_event({'eventType': 'note', 'commentID': value}, events))
                log = dict(source_id, action='commit', content='added 1 commit',
                           created_at='2026-10-01T00:01:00Z')
                events = extract_events(pr, [log], [])
                self.assertIsNone(events[-1]['id'])
                self.assertIsNone(match_event(dict(eventType='merge_request', eventAction='update',
                    eventActionDetail='source update', jobTriggerTime='2026-10-01T00:01:00Z'), events))

    def test_absent_comment_identity_cannot_match_absent_discussion_identity(self):
        events = [dict(id='7', kind='retest', time_ms=500, sha=None)]
        for env in ({'eventType': 'note'}, {'eventType': 'note', 'commentID': None},
                    {'eventType': 'note', 'commentID': ''}):
            with self.subTest(env=env):
                self.assertIsNone(match_event(env, events))
        self.assertIsNone(match_event({'eventType': 'note', 'commentID': 'None'}, events))

    def test_explicit_comment_or_discussion_id_matches_without_inventing_sha(self):
        event = dict(id=7, discussion_id='thread-7', kind='retest', time_ms=500, sha=None)
        for value in (7, '7', 'thread-7'):
            with self.subTest(value=value):
                matched = match_event({'eventType': 'note', 'commentID': value}, [event])
                self.assertIs(matched, event)
                self.assertIsNone(matched['sha'])
        self.assertIsNone(match_event({'eventType': 'note', 'commentID': 7},
                                     [event, dict(event, id=8, discussion_id='7')]))


class CollectionCountIntegrityTests(unittest.TestCase):
    def setUp(self):
        project = Catalog.load(Path(__file__).resolve().parents[1] / 'catalog.json').project('ubs')
        self.project = project
        self.repository = project['repositories'][0]
        self.context = RunContext(run_id='integrity', code_sha='0' * 40,
                                  cutoff_at='2026-10-10T00:00:00Z')
        window = self.context.window_for(project)
        self.snapshot = dict(meta=dict(repository=self.repository['repository_id'].split(':', 1)[1],
            branch='master', start_ms=round(utc_time(window['start_at']).timestamp()*1000),
            end_ms=round(utc_time(window['end_at']).timestamp()*1000), errors=[]), prs=[])

    def validate(self, **meta):
        value = copy.deepcopy(self.snapshot)
        value['meta'].update(meta)
        return validate_snapshot(self.repository, self.project, self.context, value)

    def test_missing_declared_prs_cannot_be_accepted_as_empty_success(self):
        self.assertFalse(self.validate(expected_prs=5, collected_prs=0)['passed'])
        self.assertFalse(self.validate(expected_prs=0, collected_prs=1)['passed'])
        self.assertFalse(self.validate(expected_prs=1)['passed'])

    def test_invalid_declared_counts_fail_closed(self):
        for field in ('expected_prs', 'collected_prs'):
            for invalid in (None, True, -1, 0.5, '0'):
                with self.subTest(field=field, invalid=invalid):
                    self.assertFalse(self.validate(**{field: invalid})['passed'])

    def test_genuine_empty_or_legacy_optional_counts_are_accepted(self):
        self.assertTrue(self.validate()['passed'])
        self.assertTrue(self.validate(expected_prs=0, collected_prs=0)['passed'])


if __name__ == '__main__':
    unittest.main()
