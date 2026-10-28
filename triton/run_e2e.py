"""Version 2: attributable workflow E2E, never a PR+SHA observation span."""
from datetime import datetime, timezone

WORKFLOW_ID = 241783889
WORKFLOW_PATH = '.github/workflows/ci.yml'


def stamp(value):
    try:
        result = datetime.fromisoformat(value.replace('Z', '+00:00'))
        return result if result.tzinfo else None
    except (AttributeError, TypeError, ValueError):
        return None


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
    end = max(ends) if complete and not running else None
    observed_end = stamp(as_of) if running else end
    valid = bool(start and observed_end and observed_end >= start
                 and stamp(as_of) and observed_end <= stamp(as_of))
    job_times_valid = all(not stamp(j.get('started_at')) or
                          (stamp(j.get('completed_at')) and stamp(j['completed_at']) >= stamp(j['started_at']) >= start)
                          for j in active) if start and not running else True
    duration = (observed_end - start).total_seconds() if valid and job_times_valid else None
    target = row.get('workflow_id') == WORKFLOW_ID and (row.get('path') or '').split('@')[0] == WORKFLOW_PATH
    reason = ('unresolved_pr_batch_identity' if not row.get('pr') else
              'outside_integration_tests' if not target else
              'running_observation' if running else
              'non_sample_result' if row.get('conclusion') not in ('success', 'failure', 'timed_out', 'action_required', 'startup_failure') else
              'invalid_or_missing_duration' if duration is None else
              'rerun_queue_start_unknown' if attempt > 1 else None)
    return dict(start_at=start.astimezone(timezone.utc).isoformat().replace('+00:00', 'Z') if start else None,
                end_at=end.astimezone(timezone.utc).isoformat().replace('+00:00', 'Z') if end else None,
                duration_seconds=duration, start_source=start_source,
                e2e_sample_eligible=reason is None, e2e_exclusion_reason=reason,
                e2e_metric_version=2, end_source='last_job_completed' if end else None)


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
        url=row.get('html_url')
        url=url.split('/attempts/')[0]+f'/attempts/{attempt}' if url else None
        b.update(id=f"run-{run_id}-attempt-{attempt}", action_url=url,
                 action_name=row.get('name'), critical_workflow=row.get('name'),
                 approximate=attempt > 1, aggregation_note=None, workflow_run_count=1,
                 aggregation_span_seconds=0, complete=evidence['e2e_sample_eligible'])
        if evidence['duration_seconds'] is None:
            b['missing'] = list(dict.fromkeys(b['missing'] + ['本次 job 完成时间证据不足或异常，E2E 留空']))
        b['workflows'][0].update(url=url, run_started_at=row.get('run_started_at'),
                                 attempt_source=row.get('attempt_source'),
                                 workflow_id=row.get('workflow_id'), path=row.get('path'))
        result.append(b)
    result.sort(key=lambda b: (b['start_at'] or '', b['id']))
    for b in result:
        peers = [p for p in result if b.get('pr') is not None and p.get('pr') == b['pr']
                 and p.get('e2e_exclusion_reason') != 'outside_integration_tests']
        b.update(e2e_index=peers.index(b) + 1 if b in peers else 1, e2e_total=len(peers) if b in peers else 1)
    return result
