"""Jenkins pagination and independent-audit quarantine regressions."""
import contextlib
import io
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import collect
import validate_multi
import test_source_coverage as fixtures
from test_source_coverage import empty_kind, pr_with_gate, raw_files, write_multi_tree


def build(number, timestamp):
    return dict(number=number, url=f'https://ci.example/job/test/{number}/',
                timestamp=timestamp, duration=10, result='SUCCESS', actions=[])


class CatalogBoundaryIntegrityTests(unittest.TestCase):
    def test_invalid_catalog_shape_cannot_be_reported_as_empty_success(self):
        for value in ({}, {'allBuilds': None}, {'allBuilds': {}},
                      {'allBuilds': ['not-an-object']}, []):
            with self.subTest(value=value):
                class Client:
                    def get(self, *args, **kwargs):
                        return value
                with self.assertRaises(ValueError):
                    collect.catalog(Client(), 'test', 900)

    def test_real_empty_catalog_is_a_legal_empty_result(self):
        class Client:
            def get(self, *args, **kwargs):
                return {'allBuilds': []}
        self.assertEqual(collect.catalog(Client(), 'test', 900), [])

    def test_invalid_boundary_cannot_hide_following_page(self):
        for invalid in (None, False, True, -1, '1000', float('nan'), float('inf')):
            with self.subTest(timestamp=invalid):
                pages = [{'allBuilds': [build(i, 1000) for i in range(499)] + [build(499, invalid)]},
                         {'allBuilds': [build(500, 1000)]}]
                class Client:
                    def get(self, *args, **kwargs):
                        return pages.pop(0)
                rows = collect.catalog(Client(), 'test', 900)
                self.assertIn(500, [job['number'] for job in rows])
                unknown = next(job for job in rows if job['number'] == 499)
                self.assertIsNone(unknown['start_ms'])
                self.assertFalse(pages)

    def test_real_older_timestamp_still_stops_chronological_scan(self):
        class Client:
            calls = 0
            def get(self, *args, **kwargs):
                self.calls += 1
                return {'allBuilds': [build(i, 800) for i in range(500)]}
        client = Client()
        self.assertEqual(collect.catalog(client, 'test', 900), [])
        self.assertEqual(client.calls, 1)


def invalid_evidence(field, invalid, quarantine=True):
    prs = [pr_with_gate(7), pr_with_gate(9), pr_with_gate(11)]
    job = prs[-1]['batches'][0]['children'][0]
    raw = raw_files(prs, tamper=(job['url'], {field: invalid}))
    if quarantine:
        job['start_ms' if field == 'timestamp' else 'duration_ms'] = None
        job.update(end_ms=None, total_ms=None)
        batch = prs[-1]['batches'][0]
        batch.update(eligible=False, e2e_ms=None)
        prs[-1]['metrics'] = dict(representative_batch_url=None,
            representative_batch_number=None, e2e_ms=None,
            x86=empty_kind(), arm=empty_kind(), dt=empty_kind())
    return prs, raw


class IndependentAuditTimingIntegrityTests(unittest.TestCase):
    def test_single_audit_original_module_reconciles_absence_and_rejects_invention(self):
        script = Path(__file__).resolve().parents[1] / 'validate.py'
        for quarantine in (True, False):
            with self.subTest(quarantine=quarantine), tempfile.TemporaryDirectory() as tmp:
                fixture = fixtures.SingleRepoValidateTests()
                fixture.tmp = Path(tmp)
                fixture.write_tree(*invalid_evidence('duration', -1, quarantine=quarantine))
                namespace = dict(__file__=str(script), __name__='__main__')
                original_resolve = Path.resolve
                def fixture_resolve(path, *args, **kwargs):
                    return fixture.tmp/'validate.py' if path == script else original_resolve(path, *args, **kwargs)
                try:
                    with contextlib.redirect_stdout(io.StringIO()), patch.object(Path, 'resolve', fixture_resolve):
                        if quarantine:
                            exec(compile(script.read_text('utf-8'), str(script), 'exec'), namespace)
                        else:
                            with self.assertRaises(SystemExit):
                                exec(compile(script.read_text('utf-8'), str(script), 'exec'), namespace)
                    report = json.loads((fixture.tmp/'data/validation.json').read_text('utf8'))
                    self.assertEqual(report['checks_passed'], quarantine)
                finally:
                    if namespace.get('db') is not None:
                        namespace['db'].close()

    def test_multi_audit_accepts_quarantined_invalid_source_timing(self):
        for field in ('timestamp', 'duration'):
            for invalid in (None, False, -1, '1000', float('nan'), float('inf')):
                with self.subTest(field=field, value=invalid), tempfile.TemporaryDirectory() as tmp:
                    root = Path(tmp)
                    write_multi_tree(root, *invalid_evidence(field, invalid))
                    with patch.object(validate_multi, 'ROOT', root), contextlib.redirect_stdout(io.StringIO()):
                        report = validate_multi.audit()
                    timing = report['source_audit']['categories']['job_timing']
                    self.assertTrue(report['checks_passed'])
                    self.assertEqual(timing['verified_absent'], 1)

    def test_invented_numeric_timing_is_still_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            write_multi_tree(root, *invalid_evidence('duration', -1, quarantine=False))
            with patch.object(validate_multi, 'ROOT', root), contextlib.redirect_stdout(io.StringIO()):
                with self.assertRaises(SystemExit):
                    validate_multi.audit()
            report = json.loads((root / 'data/validation-multi.json').read_text('utf8'))
            self.assertEqual(report['source_audit']['categories']['job_timing']['differences'], 1)

    def test_single_audit_accepts_quarantined_invalid_source_timing(self):
        # Reuse only the existing isolated-tree fixture, not its test cases.
        for field in ('timestamp', 'duration'):
            for invalid in (None, False, -1, float('nan'), float('inf')):
                with self.subTest(field=field, value=invalid), tempfile.TemporaryDirectory() as tmp:
                    fixture = fixtures.SingleRepoValidateTests()
                    fixture.tmp = Path(tmp)
                    fixture.write_tree(*invalid_evidence(field, invalid))
                    result = fixture.run_validate()
                    self.assertEqual(result.returncode, 0, result.stderr)
                    report = json.loads((fixture.tmp / 'data/validation.json').read_text('utf8'))
                    self.assertEqual(report['source_audit']['categories']['job_timing']['verified_absent'], 1)


if __name__ == '__main__':
    unittest.main()
