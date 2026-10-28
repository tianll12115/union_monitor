"""Offline independent checks for the snapshot accompanying this design.

This is audit evidence tooling, not dashboard implementation. Values are seconds.
"""
from collections import Counter
from datetime import datetime
import math


def stamp(value):
    return datetime.fromisoformat(value.replace('Z', '+00:00')).timestamp() if value else None


def quantile(values, q):
    ordered = sorted(values)
    if not ordered:
        return None
    position = (len(ordered) - 1) * q
    lo, hi = math.floor(position), math.ceil(position)
    return ordered[lo] + (ordered[hi] - ordered[lo]) * (position - lo)


def job_duration_check(payload):
    checked, issues = 0, []
    for batch in payload['batches']:
        for workflow in batch.get('workflows', []):
            for job in workflow.get('jobs', []):
                checked += 1
                start, end = stamp(job.get('started_at')), stamp(job.get('completed_at'))
                if start is not None and end is not None and (end < start or job.get('run_seconds') != end - start):
                    issues.append({'batch': batch['id'], 'job': job['id'],
                                   'expected_seconds': end - start, 'published_seconds': job.get('run_seconds'),
                                   'conclusion': job.get('conclusion')})
    return {'jobs_checked': checked, 'issues': issues}


def audit(payload, from_ms, to_ms, upstream=()):
    rows = payload['batches']
    visible = [b for b in rows if stamp(b.get('start_at')) is not None
               and from_ms <= stamp(b['start_at']) * 1000 <= to_ms]
    selected = [b for b in visible if b.get('is_integration_tests') is True]
    samples = [b for b in selected if b.get('e2e_sample_eligible') is True]
    values = [b['duration_seconds'] for b in samples]
    npu = [b['npu_queue_seconds'] for b in visible if b.get('npu_queue_seconds') is not None
           and b.get('status') in ('success', 'failure') and not b.get('npu_data_missing')]
    issues = []
    identities = [b['id'] for b in rows]
    if len(set(identities)) != len(identities):
        issues.append({'type': 'duplicate_identity'})
    for b in rows:
        if not b.get('e2e_sample_eligible'):
            continue
        w = b['workflows'][0]
        expected = f"https://github.com/{payload['repo']}/actions/runs/{w['id']}/attempts/{w.get('attempt', 1)}"
        if len(b['workflows']) != 1 or w.get('attempt', 1) != 1 or not b.get('is_integration_tests'):
            issues.append({'id': b['id'], 'type': 'eligibility'})
        if b.get('action_url') != expected or w.get('url') != expected:
            issues.append({'id': b['id'], 'type': 'source_url'})
        start, end = stamp(b.get('start_at')), stamp(b.get('end_at'))
        if start is None or end is None or end < start or end - start != b.get('duration_seconds'):
            issues.append({'id': b['id'], 'type': 'endpoints'})
    reconciled = []
    for source in upstream:
        run, jobs = source['run'], source['jobs']['jobs']
        active = [j for j in jobs if j.get('conclusion') != 'skipped']
        complete = bool(active) and source['jobs']['total_count'] == len(jobs) and all(
            j.get('status') == 'completed' and j.get('completed_at') for j in active)
        expected = max(stamp(j['completed_at']) for j in active) - stamp(run['created_at']) if complete else None
        batch = next((b for b in rows if b['id'] == f"run-{run['id']}-attempt-{run['run_attempt']}"), None)
        actual = batch.get('duration_seconds') if batch else None
        reconciled.append({'run_id': run['id'], 'attempt': run['run_attempt'],
                           'expected_seconds': expected, 'published_seconds': actual,
                           'matches': expected is not None and expected == actual})
    discovery = payload.get('discovery', {}).get('fetch_window_end')
    return {'payload_rows': len(rows), 'unique_ids': len(set(identities)),
            'selected_all_workflows': len(visible), 'selected_integration_runs': len(selected),
            'selected_status': dict(Counter(b['status'] for b in selected)),
            'e2e_samples': len(samples), 'e2e_p50_seconds': quantile(values, .5),
            'e2e_p90_seconds': quantile(values, .9), 'npu_samples': len(npu),
            'npu_p50_seconds': quantile(npu, .5), 'npu_p90_seconds': quantile(npu, .9),
            'creation_discovery_gap_seconds': stamp(payload['collected_at']) - stamp(discovery) if discovery else None,
            'payload_issues': issues, 'upstream_reconciliation': reconciled,
            'job_duration_check': job_duration_check(payload)}
