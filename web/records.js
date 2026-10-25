/* UDR-018 · unified batch records task — one common model for both projects.

   - default entity is batch; a PR entity is only offered where the project
     actually defines a PR E2E profile (UBS yes, Triton no), so a project
     without a PR E2E profile never fabricates a PR E2E aggregate.
   - sortRecords sorts the FULL set first (stable, unknown last, a legitimate
     0 participates, ties break by stable batch identity), and paginate only
     slices afterwards, so pagination can never reorder or drop rows.
   - normalize collapses each project's native batch rows into one record
     shape so the same records task renders both. */
(function (root) {
  'use strict';

  const PAGE_SIZES = [15, 30, 50];

  const SORT_KEYS = {
    duration: 'duration_ms', // E2E/duration
    queue: 'queue_ms',       // queue time
    start: 'start_at',       // batch start time
  };

  function identity(record) {
    if (record == null) return '';
    if (record.batch_id != null) return String(record.batch_id);
    if (record.url != null) return String(record.url);
    if (record.id != null) return String(record.id);
    return '';
  }

  /* ADR-016: duration/queue evidence is a finite, NON-NEGATIVE number. A
     legitimate 0 participates; negatives, booleans and non-finite values are
     "unknown" and carry the reason why, so they never masquerade as a real
     duration in display or sort. */
  function duration(value) {
    if (value === 0) return { value: 0, reason: null };
    if (typeof value === 'boolean') return { value: null, reason: 'boolean' };
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) return { value: null, reason: 'non-finite' };
      if (value < 0) return { value: null, reason: 'negative' };
      return { value: value, reason: null };
    }
    if (value == null || (typeof value === 'string' && value.trim() === '')) return { value: null, reason: null };
    if (typeof value !== 'string') return { value: null, reason: 'invalid-type' };
    const n = Number(value);
    if (!Number.isFinite(n)) return { value: null, reason: 'non-numeric' };
    if (n < 0) return { value: null, reason: 'negative' };
    return { value: n, reason: null };
  }

  /* A finite, non-negative number participates in sorting (including a
     legitimate 0); null/undefined/non-finite/negative/boolean is "unknown" and
     sorts last. ISO/date strings are normalised to epoch milliseconds first
     (UAR-003), so start_at columns never fall into the unknown bucket merely
     because they carry a timestamp string. */
  function numericValue(value) {
    if (typeof value === 'boolean') return null;
    if (typeof value === 'number') return Number.isFinite(value) && value >= 0 ? value : null;
    if (value == null || value === '') return null;
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}([T ]|$)/.test(value)) {
      const t = Date.parse(value);
      return Number.isFinite(t) ? t : null;
    }
    const n = typeof value === 'string' ? Number(value) : NaN;
    return Number.isFinite(n) && n >= 0 ? n : null;
  }

  function sortRecords(records, key, dir) {
    const field = SORT_KEYS[key] || key;
    const sign = dir === 'asc' ? 1 : -1;
    const arr = (Array.isArray(records) ? records : []).slice();
    arr.sort(function (a, b) {
      const av = numericValue(a[field]);
      const bv = numericValue(b[field]);
      const aUnknown = av == null;
      const bUnknown = bv == null;
      if (aUnknown !== bUnknown) return aUnknown ? 1 : -1; // unknown last, any dir
      if (!aUnknown && av !== bv) return (av > bv ? 1 : -1) * sign;
      return identity(a).localeCompare(identity(b));       // stable identity tie-break
    });
    return arr;
  }

  function paginate(records, page, pageSize) {
    const size = PAGE_SIZES.indexOf(pageSize) !== -1 ? pageSize : 15;
    const total = (Array.isArray(records) ? records : []).length;
    const pages = Math.max(1, Math.ceil(total / size));
    const p = Math.min(Math.max(1, page == null ? 1 : page), pages);
    return {
      rows: records.slice((p - 1) * size, p * size),
      page: p,
      pages: pages,
      total: total,
      pageSize: size,
    };
  }

  /* Merge every page of a paginated sort back into one sequence, exactly as
     the browser does when it walks every page/size; used by TC01 to prove the
     sort survives pagination. */
  function mergePages(records, key, dir, pageSize) {
    const sorted = sortRecords(records, key, dir);
    const out = [];
    let page = 1;
    for (;;) {
      const slice = paginate(sorted, page, pageSize);
      out.push.apply(out, slice.rows);
      if (slice.page >= slice.pages) break;
      page += 1;
    }
    return out;
  }

  /* UBS: one batch record per (PR, batch) pair. The public queue field reads the
     trigger's actual queue evidence (trigger.queue_ms = waiting+blocked+buildable);
     the top-level batch never carries queue_ms, so falling back to it is a no-op
     that previously rendered every row "—" (UAR-004). author/sha/number are kept on
     the record so the public search honors its declared fields (UAR-005). */
  function ubsBatchRecords(snapshot) {
    const repo = snapshot && snapshot.meta ? snapshot.meta.repository : '';
    const out = [];
    for (const pr of (snapshot && snapshot.prs) || []) {
      for (const b of (pr.batches) || []) {
        const rawQueue = (b.trigger && b.trigger.queue_ms != null) ? b.trigger.queue_ms : (b.queue_ms != null ? b.queue_ms : null);
        const d = duration(b.e2e_ms);
        const q = duration(rawQueue);
        out.push({
          entity: 'batch',
          project_id: 'ubs',
          repository_id: repo,
          batch_id: b.url || (pr.number + ':' + b.number),
          number: b.number,
          pr: pr.number,
          pr_state: pr.state || 'unknown',
          pr_created_at: pr.created_ms,
          title: pr.title || '',
          author: pr.author || '',
          sha: b.sha || '',
          status: b.status || 'unknown',
          duration_ms: d.value,
          duration_reason: d.reason,
          queue_ms: q.value,
          queue_reason: q.reason,
          start_at: b.request_ms,
          end_at: b.end_ms,
          source_url: b.url || '',
        });
      }
    }
    return out;
  }

  /* Triton: one record per native batch row. PR identity is preserved when
     present but never invented. */
  function tritonBatchRecords(rows, repoId) {
    const repo = repoId || 'triton-ascend';
    return (rows || []).map(function (b) {
      const d = duration(b.duration_seconds);
      const q = duration(b.npu_queue_seconds);
      return {
        entity: 'batch',
        project_id: 'triton',
        repository_id: repo,
        batch_id: b.id != null ? String(b.id) : (b.action_url || b.url || ''),
        pr: b.pr != null ? b.pr : null,
        title: b.title || '',
        status: b.status || 'unknown',
        duration_ms: d.value != null ? d.value * 1000 : null,
        duration_reason: d.reason,
        queue_ms: q.value != null ? q.value * 1000 : null,
        queue_reason: q.reason,
        start_at: b.start_at != null ? Date.parse(b.start_at) : null,
        end_at: b.end_at != null ? Date.parse(b.end_at) : null,
        source_url: b.action_url || b.pr_url || b.url || '',
      };
    });
  }

  function entityLabel(entity) {
    return entity === 'pr' ? 'PR' : '批次';
  }

  /* The PR entity is only offered where a PR E2E profile exists. */
  function entitiesForProject(projectId) {
    return projectId === 'ubs' ? ['batch', 'pr'] : ['batch'];
  }

  const api = {
    PAGE_SIZES,
    SORT_KEYS,
    identity,
    numericValue,
    duration,
    sortRecords,
    paginate,
    mergePages,
    ubsBatchRecords,
    tritonBatchRecords,
    entityLabel,
    entitiesForProject,
  };
  if (typeof module !== 'undefined') module.exports = api;
  else root.Records = api;
})(typeof window !== 'undefined' ? window : globalThis);
