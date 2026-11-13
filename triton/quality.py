"""Fail closed on missing measurements; never require an arbitrary NPU count."""
import csv
import hashlib
import json
import re
from datetime import datetime


def stamp(value):
    return datetime.fromisoformat(value.replace("Z", "+00:00")) if value else None


def validate(runs, payload):
    errors=[]; warnings=[]
    from .dashboard import summary_of, valid_seconds
    try:
        as_of=stamp(payload.get("window_end"))
    except (ValueError,TypeError,AttributeError):
        as_of=None
    # REQ-019 (A09): a payload that carries data must name a parseable as-of
    # reference, and the stored summary must agree with an independent
    # recomputation from the batches; the gate re-derives both instead of
    # trusting the stored copy (api_calls is collector telemetry, not
    # batch-derived, so it is exempt from the comparison).
    if runs or payload.get("batches"):
        if as_of is None:
            errors.append("payload window_end (as-of reference) missing or unparseable")
        recomputed=summary_of(payload.get("batches") or [])
        stored=payload.get("summary") or {}
        mismatches=[f"{k}: stored {stored.get(k)!r} != recomputed {recomputed.get(k)!r}"
                    for k in ("prs","batches","valid","median","p90","approximate","incomplete")
                    if stored.get(k)!=recomputed.get(k)]
        if mismatches:
            errors.append("payload summary contradicts its batches: "+"; ".join(mismatches))
    represented={j.get("id") for b in payload["batches"] for j in b.get("npu_jobs",[])}
    # Expected membership comes from source identities and attempt evidence,
    # never from the output being checked. A removed in-window batch cannot
    # turn itself into an out-of-window exemption.
    batched={(w.get("id"), int(w.get("attempt") or 1)) for b in payload["batches"] for w in b.get("workflows",[])}
    source_groups={}
    source_keys={}
    for run in runs:
        pair=(run.get("id"), int(run.get("run_attempt") or 1))
        attempt=pair[1]
        version2 = payload.get('e2e_metric_version') == 2
        key=("run", *pair) if version2 else (("rerun", *pair) if attempt>1 else (("initial", run.get("pr"), run.get("head_sha")) if run.get("pr") else ("unresolved", *pair)))
        source_keys[pair]=key
        try:
            start=stamp(run.get("run_started_at") if attempt>1 else run.get("created_at")) if version2 else (stamp(run.get("trigger_at")) if run.get("trigger_exact") else stamp(run.get("run_started_at") if attempt>1 else run.get("created_at")))
        except (ValueError,TypeError,AttributeError):
            start=None
        group=source_groups.setdefault(key, {"exact": [], "derived": []})
        if start is not None:
            group["exact" if run.get("trigger_exact") else "derived"].append(start)
    try:
        window_start=stamp(payload.get("window_start"))
    except (ValueError,TypeError,AttributeError):
        window_start=None
    expected=set()
    for pair,key in source_keys.items():
        group=source_groups[key]
        starts=group["exact"] or group["derived"]
        start=min(starts) if starts else None
        # Unknown start evidence cannot justify silently dropping a record.
        if start is None or ((window_start is None or start>=window_start) and (as_of is None or start<=as_of)):
            expected.add(pair)
    for pair in expected-batched:
        errors.append(f"run {pair[0]} attempt {pair[1]}: in-window workflow absent from aggregated data")
    for run in runs:
        prefix=f"run {run.get('id')}"
        if run.get("event") in ("pull_request","pull_request_target"):
            proof=run.get("pr_evidence") or {}
            if proof.get("method") == "unresolved":
                # REQ-018: an explicitly unresolved PR is a declared evidence gap,
                # surfaced on its batch ("未可靠关联 PR"), never a refresh failure.
                warnings.append(prefix+": PR identity unresolved (" + str(proof.get("error","unknown reason")) + ")")
            else:
                if not run.get("pr") or not run.get("pr_url") or not run.get("base_branch") or not run.get("pr_title"):
                    errors.append(prefix+": missing PR identity or metadata")
                if proof.get("run_id")!=run.get("id") or not proof.get("method") or proof.get("pr")!=run.get("pr") or proof.get("resolved_head_sha")!=run.get("head_sha"):
                    errors.append(prefix+": missing or inconsistent PR association evidence")
        if run.get("status")=="completed":
            try:
                created=stamp(run.get("created_at")); updated=stamp(run.get("updated_at"))
                # REQ-019 (A08): inversion is judged per workflow against its own
                # applicable start — a proven exact trigger — because the batch
                # start is the minimum over all rows; a legal auxiliary workflow
                # on the same SHA must never mask another workflow completing
                # before the trigger that started it.
                applicable=stamp(run.get("trigger_at")) if run.get("trigger_exact") else None
                if not created or not updated:
                    errors.append(prefix+": completed workflow missing created_at/updated_at")
                elif updated<created:
                    # DQ-09/TS28-007: an upstream run that reports completion
                    # before creation is contradictory source evidence, not a
                    # reason to withhold the whole dashboard for days. It is
                    # quarantined — no duration is derived from it, no zero is
                    # fabricated and it stays out of the completed percentiles —
                    # and the anomaly is disclosed as a warning instead.
                    warnings.append(prefix+": 源时间戳倒置（完成早于创建），E2E 不纳入完成分位数")
                elif applicable is not None and updated<applicable:
                    errors.append(prefix+": completed workflow ends before its applicable start")
                elif (as_of is not None and updated>as_of
                      and (own_start := stamp(run.get('run_started_at') if int(run.get('run_attempt') or 1) > 1 else run.get('created_at')))
                      and (window_start is None or own_start >= window_start) and own_start <= as_of):
                    errors.append(prefix+": completion time beyond the as-of reference")
            except (ValueError,TypeError,AttributeError):
                errors.append(prefix+": invalid workflow timestamp")
        if not run.get("jobs_complete"):
            errors.append(prefix+": incomplete job list")
        for job in run.get("jobs", []):
            name=job.get("name", "")
            # Independent of the collector's runner-name matcher.
            identity = ' '.join(str(job.get(k) or '') for k in ('name', 'runner_name', 'runner_label')).lower()
            candidate="integration-tests-ascend (" in name or bool(re.search(r"linux-(?:amd64|aarch64)-a[0-9]",identity)) or 'ascend950' in identity
            if not candidate: continue
            if (run.get("id"), int(run.get("run_attempt") or 1)) in expected and job.get("id") not in represented:
                errors.append(prefix+": NPU job absent from aggregated data")
            key=prefix+f" job {job.get('id')}: "
            from .dashboard import _is_npu_job, focus_from_jobs
            if not _is_npu_job(job): errors.append(key+"unrecognized NPU runner")
            if re.search(r"-a[35]-",name) and re.search(r"py3\.(10|11|12)",name) and not focus_from_jobs([job]):
                errors.append(key+"unrecognized focus job")
            if job.get("conclusion") in ("skipped","cancelled") and not job.get("started_at"): continue
            try:
                created=stamp(job.get("created_at")); started=stamp(job.get("started_at")); ended=stamp(job.get("completed_at"))
                if not created: errors.append(key+"missing created_at")
                if job.get("status")=="completed" and (not started or not ended): errors.append(key+"completed job missing timestamps")
                if started and created and started<created:
                    warnings.append(key+"source timestamps inverted; excluded from queue statistics")
                if ended and started and ended<started:
                    # DQ-09/TS28-007: a job that "finished" before it started is
                    # contradictory source evidence. It is quarantined (no
                    # execution duration, no E2E sample) and disclosed, never
                    # clamped to zero and never a reason to block the refresh.
                    warnings.append(key+"源时间戳倒置（完成早于开始），执行时长不采用且不纳入 E2E 分位数")
            except (ValueError,TypeError): errors.append(key+"invalid timestamp")
    for batch in payload["batches"]:
        for workflow in batch.get("workflows",[]):
            if workflow.get("event") in ("pull_request","pull_request_target"):
                if batch.get("pr") is None:
                    # Unresolved PR batches carry pr=None by design; the gap is
                    # reported via the batch "missing" list, not a lost association.
                    continue
                if workflow.get("pr")!=batch.get("pr") or workflow.get("head_sha")!=batch.get("sha") or not batch.get("pr_url"):
                    errors.append(f"batch {batch['id']}: PR association lost during aggregation")
        jobs=batch.get("npu_jobs",[])
        values=[]
        for job in jobs:
            if job.get("wait_seconds") is None: continue
            try:
                actual=(stamp(job['started_at'])-stamp(job['created_at'])).total_seconds()
                if actual<0 or actual!=job['wait_seconds']: errors.append(f"batch {batch['id']}: queue mismatch")
                values.append(actual)
            except (KeyError,TypeError,ValueError): errors.append(f"batch {batch['id']}: invalid measurement")
        expected=max(values) if values and not batch.get("npu_data_missing") else None
        if batch.get("npu_queue_seconds")!=expected: errors.append(f"batch {batch['id']}: maximum mismatch")
        try:
            b_start=stamp(batch.get("start_at")); b_end=stamp(batch.get("end_at"))
        except (ValueError,TypeError,AttributeError):
            errors.append(f"batch {batch['id']}: invalid timestamp"); b_start=b_end=None
        if b_start and b_end and b_end<b_start:
            errors.append(f"batch {batch['id']}: end before start")
        if b_start and b_end and b_end>=b_start and batch.get("status") in ("success","failure") and not (payload.get('e2e_metric_version') == 2 and batch.get('duration_seconds') is None and batch.get('e2e_sample_eligible') is False):
            # REQ-019 (A09): a completed sample's duration is its start-to-end
            # span — finite, non-negative and consistent; nulls, bools, strings,
            # negatives or invented spans are contract failures, not measurements.
            span=(b_end-b_start).total_seconds()
            value=batch.get("duration_seconds")
            if not valid_seconds(value) or abs(value-span)>1:
                errors.append(f"batch {batch['id']}: completed batch duration must be its finite non-negative start-to-end span")
        if batch.get("status") in ("success","failure") and b_start and not b_end:
            warnings.append(f"batch {batch['id']}: no valid completion time; excluded from completed statistics")
        if batch.get("status")=="running" and b_start and as_of is not None:
            observed=(as_of-b_start).total_seconds()
            value=batch.get("duration_seconds")
            quarantined = value is None and any(j.get('timeline_conflict') or j.get('run_inverted')
                for w in batch.get('workflows', []) for j in w.get('jobs', []))
            if not quarantined and (not valid_seconds(value) or abs(value-observed)>1):
                errors.append(f"batch {batch['id']}: running batch must report only the observed span to as_of")
    if payload.get('e2e_metric_version') == 2 and as_of is not None:
        errors.extend(validate_run_metrics(runs, payload))
    report={"passed":not errors,"errors":errors,"warnings":warnings,"runs":len(runs),"batches":len(payload['batches']),
            "npu_points":sum(b.get('npu_queue_seconds') is not None for b in payload['batches'])}
    return report


def validate_run_metrics(runs, payload):
    """Independent source reconciliation, not a call to the builder's measurement."""
    from .dashboard import valid_seconds
    sources={(r.get('id'), int(r.get('run_attempt') or 1)):r for r in runs}
    errors=[]; seen=set(); as_of=stamp(payload['window_end'])
    for b in payload['batches']:
        ws=b.get('workflows') or []
        pair=(ws[0].get('id'), int(ws[0].get('attempt') or 1)) if len(ws)==1 else None
        if pair not in sources or pair in seen:
            errors.append(f"batch {b['id']}: expected unique source run/attempt")
            continue
        seen.add(pair); r=sources[pair]; attempt=pair[1]
        def read(value):
            try:
                result=stamp(value)
                return result if result and result.tzinfo else None
            except (ValueError,TypeError,AttributeError):
                return None
        start=read(r.get('created_at') if attempt==1 else r.get('run_started_at'))
        jobs=[j for j in r.get('jobs',[]) if j.get('conclusion')!='skipped']
        ends=[read(j.get('completed_at')) for j in jobs]
        # DQ-09: recompute the same quarantine the builder applies, so a batch
        # that publishes a duration from contradictory timestamps still fails
        # while a quarantined batch (end/duration absent) reconciles exactly.
        from .run_e2e import inverted_job_timestamps, job_step_conflicts
        created, updated = read(r.get('created_at')), read(r.get('updated_at'))
        inverted=(inverted_job_timestamps(jobs) or any(job_step_conflicts(j) for j in jobs)
                  or bool(created and updated and updated < created))
        end=None if inverted else (max(ends) if (r.get('status')=='completed' and r.get('jobs_complete') and jobs and all(ends)
                          and all(j.get('status')=='completed' for j in jobs)
                          and (start is None or max(ends) >= start)) else None)
        observed=as_of if r.get('status')!='completed' else end
        valid=bool(start and observed and start<=observed<=as_of and not inverted)
        if r.get('status')=='completed' and start:
            valid=valid and all(not read(j.get('started_at')) or
                                (read(j.get('completed_at')) and start<=read(j['started_at'])<=read(j['completed_at'])) for j in jobs)
        seconds=(observed-start).total_seconds() if valid else None
        # Independent scope assertion: do not call the builder's predicate.
        target=(r.get('workflow_id'), (r.get('path') or '').split('@')[0]) in {
            (241783889, '.github/workflows/ci.yml'),
            (348219361, '.github/workflows/ascend-ci.yml'),
        }
        if not target and ((r.get('name') or '').strip().casefold() == 'integration tests'
                           or r.get('workflow_id') in (241783889, 348219361)
                           or (r.get('path') or '').split('@')[0] in (
                               '.github/workflows/ci.yml', '.github/workflows/ascend-ci.yml')):
            errors.append(f"run {pair[0]}: unclassified Integration Tests workflow; update verified ID/path scope before publishing")
        eligible=bool(r.get('pr') and target
                      and r.get('status')=='completed' and attempt==1 and seconds is not None
                      and r.get('conclusion') in ('success','failure','timed_out','action_required','startup_failure'))
        result = r.get('conclusion')
        status = ('running' if r.get('status') != 'completed' else
                  'failure' if result in ('failure', 'timed_out', 'action_required', 'startup_failure') else
                  'cancelled' if result in ('cancelled', 'stale') else
                  result if result in ('success', 'skipped', 'neutral') else 'unknown')
        actual=(read(b.get('start_at')),read(b.get('end_at')),b.get('duration_seconds'),b.get('action_url'),b.get('e2e_sample_eligible'),b.get('status'))
        url=r.get('html_url')
        url=url.split('/attempts/')[0]+f'/attempts/{attempt}' if url else None
        expected=(start,end,seconds,url,eligible,status)
        if actual!=expected or b.get('e2e_metric_version')!=2 or ws[0].get('url')!=url or b.get('is_integration_tests') is not target:
            errors.append(f"batch {b['id']}: source run/attempt duration, qualification or provenance mismatch")
        workflow = ws[0]
        for key in ('id', 'workflow_id', 'path', 'created_at', 'updated_at', 'status', 'conclusion', 'event', 'head_sha'):
            if workflow.get(key) != r.get(key):
                errors.append(f"batch {b['id']}: serialized workflow {key} differs from source")
        published_jobs = workflow.get('jobs') or []
        source_jobs = r.get('jobs') or []
        job_ids = [j.get('id') for j in published_jobs]
        if job_ids != [j.get('id') for j in source_jobs] or len(set(job_ids)) != len(job_ids):
            errors.append(f"batch {b['id']}: serialized job membership differs from source")
            continue
        for raw, published in zip(source_jobs, published_jobs):
            for key in ('id', 'created_at', 'started_at', 'completed_at', 'status', 'conclusion', 'runner_name'):
                if published.get(key) != raw.get(key):
                    errors.append(f"batch {b['id']}: serialized job {key} differs from source")
            source_fields = {'name': raw.get('name') or '未命名任务', 'url': raw.get('html_url'),
                             'runner_label': raw.get('runner_label'),
                             'failed_steps': [s.get('name') for s in raw.get('steps', []) if s.get('conclusion') in ('failure', 'timed_out', 'action_required')]}
            if any(published.get(key) != value for key, value in source_fields.items()):
                errors.append(f"batch {b['id']}: serialized job labels or links differ from source")
            a, z, c = read(raw.get('started_at')), read(raw.get('completed_at')), read(raw.get('created_at'))
            wait_bad, run_bad = bool(a and c and a < c), bool(a and z and z < a)
            conflict = job_step_conflicts(raw)
            wait = (a-c).total_seconds() if a and c and not wait_bad else None
            run = (z-a).total_seconds() if a and z else raw.get('duration_seconds')
            run = None if run_bad or conflict else run
            expected_timing = (wait, run, wait_bad, run_bad, conflict)
            actual_timing = tuple(published.get(k) for k in ('wait_seconds', 'run_seconds', 'wait_inverted', 'run_inverted', 'timeline_conflict'))
            valid_times = all(value is None if expected is None else valid_seconds(value) and value == expected
                              for expected, value in zip(expected_timing[:2], actual_timing[:2]))
            if not valid_times or expected_timing != actual_timing or any(type(value) is not bool for value in actual_timing[2:]):
                errors.append(f"batch {b['id']}: serialized job timing differs from source")
            messages = (['源时间戳异常：开始时间早于创建时间，排队不适用'] if wait_bad else [])
            if run_bad: messages.append('源时间戳异常：结束时间早于开始时间，执行不适用')
            if conflict: messages.append('源 job/step 时间矛盾，执行不适用')
            if published.get('measurement_error') != ('；'.join(messages) if messages else None):
                errors.append(f"batch {b['id']}: serialized anomaly differs from source")
        job_index = {j.get('id'): j for j in published_jobs}
        if any(job != job_index.get(job.get('id')) for job in b.get('npu_jobs', [])):
            errors.append(f"batch {b['id']}: NPU detail differs from source workflow jobs")
    return errors


def fingerprint(payload):
    return hashlib.sha256(json.dumps(payload,sort_keys=True,ensure_ascii=False,separators=(",", ":")).encode()).hexdigest()


def verify_page(source, manifest):
    match=re.search(r'<script[^>]*id="data"[^>]*>(.*?)</script>',source,re.S)
    if not match: raise ValueError("Published page has no dashboard data")
    payload=json.loads(match[1])
    if fingerprint(payload)!=manifest['sha256']: raise ValueError("Published data differs from this build")
    return payload


CSV_FIELDS=["pr","title","sha","base_branch","kind","start_at","end_at","status","duration_seconds","npu_queue_seconds","approximate","start_source","critical_workflow","missing","pr_url","action_url"]


def verify_artifacts(data_dir,evidence_dir=None):
    """Cross-check triton.json, the CSV export, the manifest and the build evidence (REQ-021 AC04).

    Returns a list of human-readable problems; an empty list means the artifacts
    agree on batch identity, statistics scope and collection time and may upload.
    """
    errors=[]
    payload=json.loads((data_dir/"triton.json").read_text(encoding="utf-8"))
    manifest=json.loads((data_dir/"triton-manifest.json").read_text(encoding="utf-8"))
    if manifest.get("sha256")!=fingerprint(payload):
        errors.append("triton-manifest.json sha256 does not match web/data/triton.json")
    if manifest.get("collected_at")!=payload.get("collected_at"):
        errors.append(f"manifest collected_at {manifest.get('collected_at')!r} differs from the payload {payload.get('collected_at')!r}")
    batches=payload.get("batches",[])
    with (data_dir/"triton-batches.csv").open(encoding="utf-8-sig",newline="") as handle:
        reader=csv.DictReader(handle)
        rows=list(reader)
        if reader.fieldnames!=CSV_FIELDS:
            errors.append(f"CSV header {reader.fieldnames!r} differs from the export contract")
    if len(rows)!=len(batches):
        errors.append(f"CSV carries {len(rows)} rows but triton.json has {len(batches)} batches")
    for position,(row,batch) in enumerate(zip(rows,batches)):
        for field in CSV_FIELDS:
            value=batch.get(field)
            if field=="missing" and isinstance(value,list): value="; ".join(value)
            expected="" if value is None else str(value)
            if (row.get(field) or "")!=expected:
                errors.append(f"CSV row {position} (PR {batch.get('pr')}/{batch.get('sha')}) field {field}: {row.get(field)!r} differs from {expected!r}")
                break
    qualification_file=data_dir/"triton-qualifications-v1.json"
    if qualification_file.exists() or any("e2e_sample_eligible" in b for b in batches) or "qualifications_sha256" in manifest:
        try:
            from .dashboard import qualification_manifest
            raw=qualification_file.read_bytes()
            if json.loads(raw)!=qualification_manifest(payload):
                errors.append("qualification metadata differs from the payload identities or E2E sample contract")
            if manifest.get("qualifications_file", qualification_file.name)!=qualification_file.name:
                errors.append("qualification filename differs from the versioned contract")
            if manifest.get("qualifications_sha256") and hashlib.sha256(raw).hexdigest()!=manifest["qualifications_sha256"]:
                errors.append("qualification metadata sha256 differs from the build manifest")
        except (OSError,ValueError,TypeError) as exc:
            errors.append("qualification metadata missing or invalid: "+str(exc))
    if evidence_dir is not None:
        evidence=evidence_dir/"dashboard-data.json"
        if not evidence.exists():
            errors.append(f"{evidence} missing (the build-input evidence must ship with the artifacts)")
        elif json.loads(evidence.read_text(encoding="utf-8"))!=payload:
            errors.append("evidence dashboard-data.json differs from web/data/triton.json")
    return errors
