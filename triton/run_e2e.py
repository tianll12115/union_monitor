"""Version 2: attributable workflow E2E, never a PR+SHA observation span."""
from datetime import datetime, timezone

# IDs alone or names alone cannot prove scope. Keep legacy and replacement
# workflows explicit; an unknown replacement is rejected by the quality gate.
INTEGRATION_WORKFLOWS = {
    241783889: '.github/workflows/ci.yml',
    348219361: '.github/workflows/ascend-ci.yml',
}


def stamp(value):
    try:
        result = datetime.fromisoformat(value.replace('Z', '+00:00'))
        return result if result.tzinfo else None
    except (AttributeError, TypeError, ValueError):
        return None


def inverted_job_timestamps(jobs):
    """True when a job claims to have finished before it started (source defect).

    DQ-09/TS28-007: such a pair is contradictory evidence — never a zero-second
    or negative execution. Callers quarantine the affected measurement and keep
    the raw fields instead of clamping or borrowing another timestamp.
    """
    for job in jobs:
        started, ended = stamp(job.get('started_at')), stamp(job.get('completed_at'))
        if started and ended and ended < started:
            return True
    return False


def job_step_conflicts(job):
    """Steps outside their job clock are contradictory source evidence."""
    start, end = stamp(job.get('started_at')), stamp(job.get('completed_at'))
    for step in job.get('steps') or []:
        a, b = stamp(step.get('started_at')), stamp(step.get('completed_at'))
        if ((a and b and b < a)
                or any(value and ((start and value < start) or (end and value > end)) for value in (a, b))):
            return True
    return False


def measurement(row, as_of):
    """A pure source contract; a rerun without queue origin is observation only."""
    attempt = int(row.get('run_attempt') or 1)
    historical = row.get('attempt_source') == 'enumerated'
    start_source = 'workflow_created' if attempt == 1 else ('first_job_created' if historical else 'attempt_start')
    start = stamp(row.get('created_at') if attempt == 1 else row.get('run_started_at'))
    jobs = row.get('jobs') or []
    active = [j for j in jobs if j.get('conclusion') != 'skipped']
    ends = [stamp(j.get('completed_at')) for j in active]
    running = row.get('status') != 'completed'
    complete = bool(row.get('jobs_complete') and active and all(ends)
                    and all(j.get('status') == 'completed' for j in active))
    created, updated = stamp(row.get('created_at')), stamp(row.get('updated_at'))
    inverted = (bool(active) and inverted_job_timestamps(active)) or bool(created and updated and updated < created)
    conflict = any(job_step_conflicts(job) for job in active)
    end = max(ends) if complete and not running else None
    if end is not None and (inverted or conflict or (start is not None and end < start)):
        # Contradictory source timestamps cannot prove a completion time: the
        # value stays empty and is never clamped, borrowed or measured to now.
        end = None
    observed_end = stamp(as_of) if running else end
    valid = bool(start and observed_end and observed_end >= start
                 and stamp(as_of) and observed_end <= stamp(as_of))
    job_times_valid = all(not stamp(j.get('started_at')) or
                          (stamp(j.get('completed_at')) and stamp(j['completed_at']) >= stamp(j['started_at']) >= start)
                          for j in active) if start and not running else True
    duration = (observed_end - start).total_seconds() if valid and job_times_valid and not inverted and not conflict else None
    target = (row.get('workflow_id'), (row.get('path') or '').split('@')[0]) in INTEGRATION_WORKFLOWS.items()
    reason = ('unresolved_pr_batch_identity' if not row.get('pr') else
              'outside_integration_tests' if not target else
              'running_observation' if running else
              'non_sample_result' if row.get('conclusion') not in ('success', 'failure', 'timed_out', 'action_required', 'startup_failure') else
              'source_timestamp_inversion' if inverted else
              'source_timeline_conflict' if conflict else
              'invalid_or_missing_duration' if duration is None else
              'rerun_queue_start_unknown' if attempt > 1 else None)
    return dict(start_at=start.astimezone(timezone.utc).isoformat().replace('+00:00', 'Z') if start else None,
                end_at=end.astimezone(timezone.utc).isoformat().replace('+00:00', 'Z') if end else None,
                duration_seconds=duration, start_source=start_source,
                e2e_sample_eligible=reason is None, e2e_exclusion_reason=reason,
                e2e_metric_version=2, is_integration_tests=target, end_source='last_job_completed' if end else None)


def build_run_batches(runs, as_of, window_start=None):
    # Reuse only single-row metadata/NPU serialization, never the legacy grouping.
    from .dashboard import build_batches
    result = []
    unique = {(r.get('id'), int(r.get('run_attempt') or 1)): r for r in runs}
    for (run_id, attempt), row in unique.items():
        evidence = measurement(row, as_of)
        if evidence['start_at'] and window_start and stamp(evidence['start_at']) < stamp(window_start):
            continue
        if evidence['start_at'] and stamp(evidence['start_at']) > stamp(as_of):
            continue
        b = build_batches([row], as_of)[0]
        b.update(evidence)
        if row.get('status') == 'completed' and row.get('conclusion') not in (
                'success', 'failure', 'timed_out', 'action_required', 'startup_failure', 'cancelled', 'stale'):
            b['status'] = row.get('conclusion') if row.get('conclusion') in ('skipped', 'neutral') else 'unknown'
        url=row.get('html_url')
        url=url.split('/attempts/')[0]+f'/attempts/{attempt}' if url else None
        b.update(id=f"run-{run_id}-attempt-{attempt}", action_url=url,
                 action_name=row.get('name'), critical_workflow=row.get('name'),
                 approximate=attempt > 1, aggregation_note=None, workflow_run_count=1,
                 aggregation_span_seconds=0, complete=evidence['e2e_sample_eligible'])
        if evidence['duration_seconds'] is None:
            note = ('源时间戳倒置，执行时长与 E2E 均不采用'
                    if evidence['e2e_exclusion_reason'] == 'source_timestamp_inversion'
                    else '源 job/step 时间矛盾，执行时长与 E2E 均不采用'
                    if evidence['e2e_exclusion_reason'] == 'source_timeline_conflict'
                    else '本次 job 完成时间证据不足或异常，E2E 留空')
            b['missing'] = list(dict.fromkeys(b['missing'] + [note]))
        b['workflows'][0].update(url=url, run_started_at=row.get('run_started_at'),
                                 attempt_source=row.get('attempt_source'),
                                 workflow_id=row.get('workflow_id'), path=row.get('path'))
        result.append(b)
    result.sort(key=lambda b: (b['start_at'] or '', b['id']))
    for b in result:
        peers = [p for p in result if b.get('pr') is not None and p.get('pr') == b['pr']
                 and p.get('is_integration_tests') is True]
        b.update(e2e_index=peers.index(b) + 1 if b in peers else 1, e2e_total=len(peers) if b in peers else 1)
    return result
