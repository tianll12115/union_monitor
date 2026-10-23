"""Read-only application probes; writes only backend-* evidence beside this file."""
import json
import pathlib
import sys

ROOT = next(p for p in pathlib.Path(__file__).resolve().parents if (p/'catalog.json').is_file() and (p/'monitor').is_dir())
sys.path.insert(0, str(ROOT))
from triton.source_verify import build_coverage_evidence
from monitor.assemble import assemble_release, is_publishable
from monitor.catalog import Catalog
from monitor.context import RunContext
from monitor.release_policy import is_readable_fallback
from monitor.public_verify import sha256_bytes

out_dir = pathlib.Path(__file__).resolve().parent
probe_data = out_dir / 'backend-probe-data'
(probe_data / 'jobs').mkdir(parents=True, exist_ok=True)
(probe_data / 'prs').mkdir(parents=True, exist_ok=True)
(probe_data / 'jobs' / '1-1.json').write_text('[{"id":10,"name":"ordinary"}]', encoding='utf-8')
(probe_data / 'prs' / '999.json').write_text('{"pr":7}', encoding='utf-8')
runs = {'runs': [{'id': 1, 'run_attempt': 1}], 'window_start': '2026-01-01T00:00:00Z', 'window_end': '2026-01-02T00:00:00Z'}
payload = {'window_start': '2026-02-01T00:00:00Z', 'window_end': '2026-02-02T00:00:00Z', 'batches': [{'pr': 7, 'workflows': [{'id': 1, 'attempt': 1}], 'npu_jobs': []}]}
coverage = build_coverage_evidence(runs, probe_data/'jobs', payload, pr_dir=probe_data/'prs')
catalog = Catalog.load(ROOT/'catalog.json')
context = RunContext(run_id='audit', code_sha='a'*40, cutoff_at='2026-10-23T00:00:00Z')
reports = {pid: {'collection_status': 'success', 'validation_status': 'passed', 'snapshot_version': 'fake', 'snapshot_sha256': '0'*64, 'snapshot_path': 'missing.json'} for pid in catalog.enabled_project_ids()}
candidate = assemble_release(catalog, context, reports, release_id='fake', published_at='2026-10-23T00:00:00Z')
raw = b'this is neither a snapshot nor a supported schema'
entry = {'snapshot_path': 'data/fake.json', 'snapshot_sha256': sha256_bytes(raw), 'metric_profile': 'obsolete-unknown-profile'}
result = {
 'source_verify_wrong_window_deleted_job_unrelated_pr_evidence': coverage,
 'direct_assemble_missing_files_is_publishable': is_publishable(candidate),
 'default_fallback_accepts_invalid_schema_unknown_profile': is_readable_fallback(entry, {'data/fake.json': raw}),
}
(out_dir/'backend-probes.json').write_text(json.dumps(result, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
print(json.dumps(result, ensure_ascii=False, indent=2))
