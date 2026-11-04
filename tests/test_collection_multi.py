import argparse
import io
import json
import shutil
import tempfile
import unittest
import urllib.error
from pathlib import Path
from unittest.mock import patch

import collect


class CollectionTests(unittest.TestCase):
    def test_discovery_uses_report_paths_and_ignores_other_comment_authors(self):
        class Client:
            def pages(self, url):
                return [
                    {'id': 1, 'user': {'login': 'openeuler-ci-bot'}, 'body': 'https://ci.openeuler.openatom.cn/job/custom/job/trigger/job/other-name//123/console'},
                    {'id': 2, 'user': {'login': 'someone'}, 'body': 'https://ci.openeuler.openatom.cn/job/wrong/job/trigger/job/name/1/'},
                ]
        paths, comments = collect.discover_jobs(Client(), 'api', [{'number': 7}], [])
        self.assertEqual(list(paths), ['custom/trigger/other-name'])
        self.assertEqual(paths['custom/trigger/other-name']['kind'], 'trigger')
        self.assertEqual(paths['custom/trigger/other-name']['evidence'][0]['pr'], 7)
        self.assertEqual(len(comments[7]), 2)

    def test_all_shares_cutoff_and_failure_keeps_previous_snapshot(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root/'data').mkdir()
            old = {'repositories': [{'name': 'ubs-comm', 'status': 'success', 'snapshot': 'repos/ubs-comm.json', 'meta': {'end_ms': 1}}]}
            (root/'data/repositories.json').write_text(json.dumps(old))
            cutoffs = []

            def run(args, config, client):
                cutoffs.append(args.until)
                if config['name'] == 'ubs-comm':
                    raise OSError('unavailable')
                return {'meta': {'repository': config['repository'], 'errors': []}}

            args = argparse.Namespace(until='2026-09-10T00:00:00+00:00', days=30, refresh=False, offline=True, all=True, repo='ubs-engine')
            with patch.object(collect, 'ROOT', root), patch.object(collect, 'run', run), patch.object(collect, 'publish_index'):
                result = collect.collect_many(args)
            self.assertEqual(len(result), 9)
            self.assertEqual(len(set(cutoffs)), 1)
            failed = next(r for r in result if r['name'] == 'ubs-comm')
            self.assertEqual(failed['status'], 'failed')
            self.assertEqual(failed['meta'], {'end_ms': 1})
            self.assertEqual(failed['snapshot'], 'repos/ubs-comm.json')
            self.assertEqual(result[-1]['status'], 'success')


class ClientRetryTests(unittest.TestCase):
    """2026-11-01: GitCode 429s failed every repository of the daily refresh."""

    class Response:
        def __init__(self, body):
            self._body = json.dumps(body).encode('utf-8')
            self.headers = {'Content-Type': 'application/json'}
        def __enter__(self): return self
        def __exit__(self, *exc): return False
        def read(self): return self._body

    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp(prefix='ubs-429-'))
        self.addCleanup(shutil.rmtree, self.tmp, ignore_errors=True)

    def test_rate_limited_request_waits_for_the_advertised_window_then_succeeds(self):
        calls, sleeps = [], []
        def fake_open(request, timeout=None):
            calls.append(request.full_url)
            if len(calls) < 3:
                raise urllib.error.HTTPError(request.full_url, 429, 'Too Many Requests',
                                             {'Retry-After': '30'}, io.BytesIO(b''))
            return self.Response([{'id': 1}])
        client = collect.Client(self.tmp / 'cache')
        with patch('collect.urllib.request.urlopen', fake_open), patch('collect.time.sleep', sleeps.append):
            body = client.get('https://api.gitcode.com/api/v5/repos/x/pulls')
        self.assertEqual(body, [{'id': 1}])
        # The request throttle also sleeps; only the rate-limit waits are asserted.
        self.assertEqual([wait for wait in sleeps if wait > 1], [30.0, 30.0])

    def test_rate_limit_without_retry_after_falls_back_to_bounded_backoff(self):
        calls, sleeps = [], []
        def fake_open(request, timeout=None):
            calls.append(request.full_url)
            if len(calls) < 2:
                raise urllib.error.HTTPError(request.full_url, 429, 'Too Many Requests', {}, io.BytesIO(b''))
            return self.Response([{'id': 2}])
        client = collect.Client(self.tmp / 'cache2')
        with patch('collect.urllib.request.urlopen', fake_open), patch('collect.time.sleep', sleeps.append):
            body = client.get('https://api.gitcode.com/api/v5/repos/x/pulls')
        self.assertEqual(body, [{'id': 2}])
        self.assertEqual([wait for wait in sleeps if wait > 1], [5.0])

    def test_exhausted_retries_still_raise_the_source_failure(self):
        def fake_open(request, timeout=None):
            raise urllib.error.HTTPError(request.full_url, 429, 'Too Many Requests', {'Retry-After': '1'}, io.BytesIO(b''))
        client = collect.Client(self.tmp / 'cache')
        with patch('collect.urllib.request.urlopen', fake_open), patch('collect.time.sleep'):
            with self.assertRaises(urllib.error.HTTPError):
                client.get('https://api.gitcode.com/api/v5/repos/x/pulls')

    def test_transport_errors_are_retried_and_then_raised(self):
        calls = []
        def fake_open(request, timeout=None):
            calls.append(request.full_url)
            raise OSError('connection reset')
        client = collect.Client(self.tmp / 'cache3')
        with patch('collect.urllib.request.urlopen', fake_open), patch('collect.time.sleep'):
            with self.assertRaises(OSError):
                client.get('https://api.gitcode.com/api/v5/repos/x/pulls')
        self.assertEqual(len(calls), 4)


if __name__ == '__main__':
    unittest.main()
