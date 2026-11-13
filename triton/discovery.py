"""Fail-closed GitHub discovery without a creation-age cutoff for reruns."""
from datetime import datetime, timedelta, timezone
from urllib.parse import quote


def _interval_pages(api, path, declared):
    """Use actual pages/Link, never equality with an approximate total_count."""
    out, seen, page, required_next = [], set(), 1, False
    while True:
        data, headers = api.get(f"{path}&per_page=100&page={page}")
        rows = data.get("workflow_runs") if isinstance(data, dict) else None
        if not isinstance(rows, list):
            raise RuntimeError(f"{path}: page {page} has no usable workflow_runs array")
        if not rows and (required_next or (page == 1 and declared > 0)):
            raise RuntimeError(f"{path}: empty page contradicts discovery/next-page evidence")
        for row in rows:
            if not isinstance(row, dict) or row.get("id") is None:
                raise RuntimeError(f"{path}: page {page} has a run without identity")
            if row["id"] in seen:
                raise RuntimeError(f"{path}: duplicate run id={row['id']} across pages")
            seen.add(row["id"])
        out.extend(rows)
        if len(out) >= 1000:
            return None  # actual saturation wins over an underestimated count
        link = next((value for key, value in headers.items() if key.lower() == "link"), "")
        required_next = any('rel="next"' in part or "rel='next'" in part for part in link.split(","))
        if not required_next and len(rows) < 100:
            return out
        page += 1


def interval_runs(api, start, end, event):
    """Query inclusive whole-second partitions without gaps or infinite splits."""
    from .dashboard import iso
    start, end = start.replace(microsecond=0), end.replace(microsecond=0)
    if end < start:
        return []
    created = quote(f"{iso(start)}..{iso(end)}", safe="")
    path = f"/actions/runs?event={event}&created={created}"
    first, _ = api.get(path + "&per_page=1")
    count = first.get("total_count") if isinstance(first, dict) else None
    if not isinstance(count, int) or isinstance(count, bool) or count < 0:
        raise RuntimeError(f"{path}: response has no usable total_count")
    if count >= 1000:
        seconds = int((end - start).total_seconds())
        if seconds == 0:
            raise RuntimeError(f"{path}: single-second interval exceeds GitHub's result cap")
        middle = start + timedelta(seconds=seconds // 2)
        return interval_runs(api, start, middle, event) + interval_runs(api, middle + timedelta(seconds=1), end, event)
    rows = _interval_pages(api, path, count)
    if rows is not None:
        return rows
    seconds = int((end - start).total_seconds())
    if seconds == 0:
        raise RuntimeError(f"{path}: single-second interval reaches GitHub's result cap")
    middle = start + timedelta(seconds=seconds // 2)
    return interval_runs(api, start, middle, event) + interval_runs(api, middle + timedelta(seconds=1), end, event)


def full_history_runs(api, start, end):
    """Partition the entire retained creation history below GitHub query caps.

    A first-attempt run wholly before the window needs no job requests. Every
    rerun created by the cutoff remains a candidate: an intermediate attempt
    may belong to the window even when the latest attempt does not.
    Fixed creation bounds exclude newly born runs during pagination. Approximate
    source counts only guide splitting; actual rows and Link control pagination.
    """
    from .dashboard import dt, run_in_window
    origin = datetime(2008, 1, 1, tzinfo=timezone.utc)
    rows = []
    for event in ("pull_request", "pull_request_target"):
        rows.extend(interval_runs(api, origin, end, event))
    unique = {}
    identity_fields = ("id", "run_attempt", "event", "created_at", "run_started_at", "updated_at", "head_sha", "workflow_id", "path")
    for row in rows:
        if row.get("event") not in ("pull_request", "pull_request_target"):
            raise RuntimeError(f"run {row.get('id')}: invalid PR discovery event")
        if type(row.get("run_attempt")) is not int or row["run_attempt"] < 1:
            raise RuntimeError(f"run {row.get('id')}: invalid run_attempt")
        previous = unique.get(row["id"])
        if previous is not None and any(previous.get(key) != row.get(key) for key in identity_fields):
            raise RuntimeError(f"run {row['id']}: conflicting identity across discovery partitions")
        unique[row["id"]] = row
    candidates, entries = [], []
    for row in unique.values():
        created = dt(row.get("created_at"))
        if created is None:
            raise RuntimeError(f"run {row.get('id')}: discovery requires created_at")
        candidate = False
        if created > end:
            reason = "created_after_discovery_cutoff"
        elif int(row.get("run_attempt") or 1) > 1:
            candidate, reason = True, "rerun_requires_attempt_enumeration"
        elif run_in_window(row, start, end):
            candidate, reason = True, "first_attempt_in_window"
        else:
            reason = "first_attempt_before_display_window"
        entry = {key: row.get(key) for key in ("id", "run_attempt", "event", "created_at", "run_started_at", "updated_at")}
        entry.update(run_attempt=int(row.get("run_attempt") or 1), candidate=candidate, reason=reason)
        entries.append(entry)
        if candidate:
            candidates.append(row)
    api.discovery_evidence = {"schema_version": 1, "method": "partitioned_created_history",
                              "creation_floor": "2008-01-01T00:00:00Z", "creation_cutoff": end.isoformat(),
                              "enumerated_runs": len(entries), "candidate_runs": len(candidates),
                              "excluded_runs": len(entries) - len(candidates), "entries": entries,
                              "boundary": "Only source-retained records; paginated observations are not an atomic snapshot."}
    return candidates


def replay_discovery(meta, runs, ledger):
    """Offline replay must retain and reconcile its original discovery proof."""
    disclosure = meta['discovery']
    if not isinstance(ledger, dict) or not isinstance(ledger.get('entries'), list):
        raise ValueError('discovery ledger missing or invalid')
    entries = ledger['entries']
    identities = [(e.get('id'), e.get('run_attempt')) for e in entries]
    if len(set(identities)) != len(entries) or any(type(e.get('candidate')) is not bool or not e.get('reason') for e in entries):
        raise ValueError('discovery ledger identities/classifications invalid')
    candidates = {ident for ident, entry in zip(identities, entries) if entry['candidate']}
    source = {(r.get('id'), int(r.get('run_attempt') or 1)) for r in runs}
    if not candidates <= source:
        raise ValueError('discovery candidates missing from retained source')
    counts = dict(enumerated_runs=len(entries), candidate_runs=len(candidates), excluded_runs=len(entries)-len(candidates))
    if any(ledger.get(key) != value or disclosure.get(key) != value for key, value in counts.items()):
        raise ValueError('discovery counts contradict retained identities')
    return dict(disclosure)
