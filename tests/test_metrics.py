import unittest
from datetime import datetime
from metrics import (summarize, classify, measure_batch, normalize_job, in_scope,
                     extract_events, match_event, latest_submission,
                     valid_submission_ms, SUBMISSION_TIME_PROFILE)

def job(result='SUCCESS', start=1000, duration=2000, url='j/1/', **kw):
    return dict(url=url, result=result, start_ms=start, duration_ms=duration, end_ms=start+duration, building=False, **kw)

class MetricsTest(unittest.TestCase):
    def test_percentile_inc(self):
        self.assertEqual(summarize([0, 100, 200, 300]), {'n':4,'mean':150,'p90':270})
        self.assertEqual(summarize([123])['p90'],123)
        self.assertIsNone(summarize([])['mean'])
    def test_trigger_success_does_not_override_child_failure(self):
        self.assertEqual(classify(job(),[job('FAILURE')],True),'failure')
    def test_all_children_required(self):
        self.assertEqual(classify(job(),[job()],True),'success')
        self.assertEqual(classify(job(),[job()],False),'incomplete')
        self.assertEqual(classify(job(),[],True),'incomplete')
    def test_running_and_aborted(self):
        j=job();j['building']=True
        self.assertEqual(classify(job(),[j],True),'running')
        self.assertEqual(classify(job(),[job('ABORTED')],True),'failure')
    def test_parallel_e2e_uses_latest_completion(self):
        b=measure_batch(job(),[job(start=1500,duration=5000)],500,True)
        self.assertEqual(b['e2e_ms'],6000)
        self.assertTrue(b['eligible'])
    def test_missing_request_is_excluded_but_completed_cancellation_is_measurable(self):
        b=measure_batch(job(),[job()],None,True)
        self.assertIsNone(b['e2e_ms'])
        self.assertFalse(b['eligible'])
        self.assertTrue(measure_batch(job(),[job('ABORTED')],500,True)['eligible'])
    def test_queue_is_not_zero_when_missing(self):
        j=normalize_job({'url':'j/1/','timestamp':10000,'duration':1000,'result':'SUCCESS','actions':[]})
        self.assertIsNone(j['queue_ms'])
        j=normalize_job({'url':'j/1/','timestamp':10000,'duration':1000,'result':'SUCCESS','actions':[{'waitingTimeMillis':100,'blockedTimeMillis':200,'buildableTimeMillis':300}]})
        self.assertEqual(j['total_ms'],1600)
        self.assertEqual(j['scheduled_ms'],9400)
    def test_scope_includes_all_three_states(self):
        for state in ['open','closed','merged']:
            self.assertTrue(in_scope({'base':{'ref':'master'},'created_at':'2026-09-01T00:00:00+08:00','state':state},0,9999999999999))
        self.assertFalse(in_scope({'base':{'ref':'other'},'created_at':'2026-09-01T00:00:00+08:00'},0,9999999999999))
    def test_retest_exact_discussion_and_ambiguous_push(self):
        p={'number':1,'created_at':'2026-09-01T00:00:00+08:00'}
        comments=[{'id':1,'discussion_id':'abc','body':'/retest','created_at':'2026-09-01T00:01:00+08:00'}]
        ev=extract_events(p,[],comments)
        self.assertEqual(match_event({'eventType':'note','commentID':'abc'},ev)['kind'],'retest')
        self.assertIsNone(match_event({'eventType':'merge_request','eventAction':'update','jobTriggerTime':'2026-09-01T00:01:00+08:00'},ev))
    def test_create_sha_comes_from_platform_creation_log(self):
        p={'number':1,'created_at':'2026-09-01T00:00:00+08:00'}
        logs=[{'action':'commit','content':'create merge request[project id:8744708, iid:1, commit_id:53d1bfb67c0d51c02642d8788fb1bfc57613f7ca], virtual merging success'}]
        ev=extract_events(p,logs,[{'id':1,'body':'/retest','created_at':'2026-09-01T00:01:00+08:00'}])
        self.assertEqual(ev[0]['sha'],'53d1bfb67c0d51c02642d8788fb1bfc57613f7ca')
        self.assertEqual(ev[1]['sha'],ev[0]['sha'])


def iso_ms(value):
    parsed = datetime.fromisoformat(value)
    return round(parsed.timestamp() * 1000)


class SubmissionTimeTests(unittest.TestCase):
    """PSG-001：提交时间派生只认权威 create/push，重跑/评论永不更新时间。"""

    def _sample(self):
        """第6节相反时钟样本（上海时间，截止 09:00）。"""
        cutoff = iso_ms('2026-10-22T09:00:00+08:00')
        ev = lambda kind, at, src: {'id': f'{kind}-{at}', 'kind': kind,
                                    'source': src, 'time_ms': iso_ms(at)}
        prs = {
            101: [ev('create', '2026-10-20T08:00:00+08:00', 'PR.created_at'),
                  ev('push', '2026-10-22T08:30:00+08:00', 'operate_logs'),
                  ev('retest', '2026-10-22T08:59:00+08:00', 'comments')],
            102: [ev('create', '2026-10-22T08:45:00+08:00', 'PR.created_at')],
            103: [ev('create', '2026-10-19T08:00:00+08:00', 'PR.created_at'),
                  ev('push', '2026-10-22T08:55:00+08:00', 'operate_logs')],
            104: [ev('create', '2026-10-18T08:00:00+08:00', 'PR.created_at'),
                  ev('push', '2026-10-22T08:55:00+08:00', 'operate_logs')],
            105: [],
        }
        return cutoff, prs

    def test_section6_recomputes_expected_order(self):
        cutoff, prs = self._sample()
        values = {n: latest_submission(events, cutoff)[0] for n, events in prs.items()}
        order = sorted(prs, key=lambda n: (values[n] is None, -(values[n] or 0), -n))
        self.assertEqual(order, [104, 103, 102, 101, 105])

    def test_retest_never_updates_push_time(self):
        cutoff, prs = self._sample()
        _, event = latest_submission(prs[101], cutoff)
        self.assertEqual(event['id'], 'push-2026-10-22T08:30:00+08:00')
        self.assertEqual(event['kind'], 'push')

    def test_ungated_push_still_counts(self):
        cutoff, prs = self._sample()
        ms_value, event = latest_submission(prs[103], cutoff)
        self.assertEqual(ms_value, iso_ms('2026-10-22T08:55:00+08:00'))
        self.assertEqual(event['kind'], 'push')

    def test_create_only_uses_creation_time(self):
        cutoff, prs = self._sample()
        ms_value, event = latest_submission(prs[102], cutoff)
        self.assertEqual(ms_value, iso_ms('2026-10-22T08:45:00+08:00'))
        self.assertEqual(event['kind'], 'create')

    def test_no_events_is_unknown(self):
        cutoff, prs = self._sample()
        self.assertEqual(latest_submission(prs[105], cutoff), (None, None))

    def test_valid_submission_ms_boundary(self):
        cutoff = 1000
        self.assertTrue(valid_submission_ms(0, cutoff))
        self.assertTrue(valid_submission_ms(1000, cutoff))
        for bad in (None, False, '', '0', -1, 0.5, float('nan'), float('inf'),
                    cutoff + 1):
            self.assertFalse(valid_submission_ms(bad, cutoff), bad)

    def test_late_events_are_excluded(self):
        cutoff = iso_ms('2026-10-22T09:00:00+08:00')
        events = [{'id': 'c', 'kind': 'create', 'source': 'PR.created_at',
                   'time_ms': iso_ms('2026-10-22T10:00:00+08:00')}]
        self.assertEqual(latest_submission(events, cutoff), (None, None))

    def test_legacy_events_without_source_resolve_by_kind(self):
        cutoff = iso_ms('2026-10-22T09:00:00+08:00')
        events = [{'id': 'c', 'kind': 'create', 'time_ms': 1000},
                  {'id': 'p', 'kind': 'push', 'time_ms': 2000},
                  {'id': 'r', 'kind': 'retest', 'time_ms': 9999}]
        ms_value, event = latest_submission(events, cutoff)
        self.assertEqual(ms_value, 2000)
        self.assertEqual(event['kind'], 'push')

    def test_push_wins_tie_at_equal_millisecond(self):
        events = [{'id': 'c', 'kind': 'create', 'source': 'PR.created_at', 'time_ms': 5000},
                  {'id': 'p', 'kind': 'push', 'source': 'operate_logs', 'time_ms': 5000}]
        _, event = latest_submission(events, 10000)
        self.assertEqual(event['kind'], 'push')


if __name__=='__main__': unittest.main()
