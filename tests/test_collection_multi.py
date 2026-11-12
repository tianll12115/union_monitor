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


    def test_rate_limited_repositories_are_retried_after_the_cooldown(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root/'data').mkdir()
            attempts = []
            sleeps = []
            def run(args, config, client):
                attempts.append(config['name'])
                if config['name'] == 'ubs-engine' and attempts.count('ubs-engine') == 1:
                    raise OSError('HTTP Error 429: Too Many Requests')
                return {'meta': {'repository': config['repository'], 'errors': []}}
            args = argparse.Namespace(until='2026-09-10T00:00:00+00:00', days=30, refresh=False, offline=False, all=True, repo='ubs-engine')
            with patch.object(collect, 'ROOT', root), patch.object(collect, 'run', run), \
                 patch.object(collect, 'publish_index'), patch.object(collect, 'Client'), \
                 patch('collect.time.sleep', sleeps.append):
                result = collect.collect_many(args)
            self.assertEqual(attempts.count('ubs-engine'), 2)
            self.assertEqual(attempts.count('ubs-comm'), 1)
            self.assertIn(collect.RATE_LIMIT_COOLDOWN, sleeps)
            engine = next(r for r in result if r['name'] == 'ubs-engine')
            self.assertEqual((engine['status'], engine['error']), ('success', None))

    def test_single_repository_does_not_retry_previous_unselected_rate_limit(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root/'data').mkdir()
            previous = {'name': 'ubs-comm', 'status': 'failed',
                        'error': 'HTTP Error 429: Too Many Requests'}
            (root/'data/repositories.json').write_text(json.dumps({'repositories': [previous]}))
            attempts, sleeps = [], []
            def run(args, config, client):
                attempts.append(config['name'])
                return {'meta': {'errors': []}}
            args = argparse.Namespace(until='2026-09-10T00:00:00+00:00', days=30,
                                      refresh=False, offline=False, all=False, repo='ubs-engine')
            with patch.object(collect, 'ROOT', root), patch.object(collect, 'run', run), \
                 patch.object(collect, 'publish_index'), patch.object(collect, 'Client'), \
                 patch('collect.time.sleep', sleeps.append):
                result = collect.collect_many(args)
            self.assertEqual(attempts, ['ubs-engine'])
            self.assertEqual(sleeps, [])
            unselected = next(r for r in result if r['name'] == 'ubs-comm')
            self.assertEqual(unselected['status'], previous['status'])
            self.assertEqual(unselected['error'], previous['error'])

    def test_other_failures_do_not_trigger_a_cooldown_retry(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root/'data').mkdir()
            attempts, sleeps = [], []
            def run(args, config, client):
                attempts.append(config['name'])
                raise OSError('repository moved')
            args = argparse.Namespace(until='2026-09-10T00:00:00+00:00', days=30, refresh=False, offline=False, all=True, repo='ubs-engine')
            with patch.object(collect, 'ROOT', root), patch.object(collect, 'run', run), \
                 patch.object(collect, 'publish_index'), patch.object(collect, 'Client'), \
                 patch('collect.time.sleep', sleeps.append):
                result = collect.collect_many(args)
            self.assertEqual(len(attempts), 9)
            self.assertEqual(sleeps, [])
            self.assertEqual({r['status'] for r in result}, {'failed'})


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
        self.assertEqual([wait for wait in sleeps if wait > 1], [30.0])

    def test_a_window_without_retry_after_escalates_up_to_the_bound(self):
        calls, sleeps = [], []
        def fake_open(request, timeout=None):
            calls.append(request.full_url)
            raise urllib.error.HTTPError(request.full_url, 429, 'Too Many Requests', {}, io.BytesIO(b''))
        client = collect.Client(self.tmp / 'cache4')
        with patch('collect.urllib.request.urlopen', fake_open), patch('collect.time.sleep', sleeps.append):
            with self.assertRaises(urllib.error.HTTPError):
                client.get('https://api.gitcode.com/api/v5/repos/x/pulls')
        self.assertEqual(len(calls), 5)
        self.assertEqual([wait for wait in sleeps if wait > 1], [30.0, 60.0, 120.0, 120.0])

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
        self.assertEqual(len(calls), 5)


class GateReportLinkTests(unittest.TestCase):
    """2026-11-04: the UBSCore gate moved its report to `openeuler-bot` on the
    log mirror, so every UBS PR lost its batches while ham/ubturbo kept them."""

    def test_log_mirror_links_normalise_to_the_jenkins_build_url(self):
        cases = {
            'https://log-ci.openeuler.openatom.cn/job/multiarch/openeuler/trigger/ubs-engine/8086/':
                'https://ci.openeuler.openatom.cn/job/multiarch/job/openeuler/job/trigger/job/ubs-engine/8086/',
            'https://log-ci.openeuler.openatom.cn/job/multiarch/manual-jobs/openeuler/UBSCore/pre-commit/ubs-engine/7065/':
                'https://ci.openeuler.openatom.cn/job/multiarch/job/manual-jobs/job/openeuler/job/UBSCore/job/pre-commit/job/ubs-engine/7065/',
            'https://log-ci.openeuler.openatom.cn/job/multiarch/openeuler/aarch64/ubs-engine/8084/console':
                'https://ci.openeuler.openatom.cn/job/multiarch/job/openeuler/job/aarch64/job/ubs-engine/8084/',
        }
        for linked, expected in cases.items():
            self.assertEqual(collect.canonical(linked), expected)
            self.assertEqual(collect.job_path(expected).split('/')[0], 'multiarch')

    def test_ci_host_and_legacy_double_slash_keep_their_identity(self):
        self.assertEqual(collect.canonical('https://ci.openeuler.openatom.cn/job/Infra/job/docs/job/openeuler-docs-ci-step2/23661//console'),
                         'https://ci.openeuler.openatom.cn/job/Infra/job/docs/job/openeuler-docs-ci-step2/23661/')
        self.assertEqual(collect.canonical('https://ci.openeuler.openatom.cn/job/multiarch/job/openeuler/job/trigger/job/ham/12//console'),
                         'https://ci.openeuler.openatom.cn/job/multiarch/job/openeuler/job/trigger/job/ham/12/')

    def test_foreign_hosts_and_links_without_a_build_number_are_not_evidence(self):
        self.assertIsNone(collect.canonical('https://ci.example.com/job/multiarch/job/trigger/job/x/job/1/'))
        self.assertIsNone(collect.canonical('https://log-ci.openeuler.openatom.cn/job/multiarch/openeuler/trigger/ubs-engine/'))
        self.assertEqual(collect.links('见 https://ci.example.com/job/a/job/1/'), set())

    def test_a_gate_report_yields_both_report_hosts_without_duplicates(self):
        body = ('门禁正在运行: <a href=https://log-ci.openeuler.openatom.cn/job/multiarch/openeuler/trigger/ubs-engine/8086/>'
                'multiarch/openeuler/trigger/ubs-engine/8086</a> 以及 '
                'https://ci.openeuler.openatom.cn/job/multiarch/job/openeuler/job/trigger/job/ubs-engine/8086/ 与 '
                'https://ci.openeuler.openatom.cn/job/Infra/job/docs/job/openeuler-docs-ci-step2/23661//console')
        self.assertEqual(collect.links(body), {
            'https://ci.openeuler.openatom.cn/job/multiarch/job/openeuler/job/trigger/job/ubs-engine/8086/',
            'https://ci.openeuler.openatom.cn/job/Infra/job/docs/job/openeuler-docs-ci-step2/23661/',
        })

    def test_discovery_accepts_the_gate_bot_and_ignores_human_links(self):
        class Client:
            def pages(self, url):
                return [
                    {'id': 1, 'user': {'login': 'openeuler-bot'},
                     'body': '门禁入口: https://log-ci.openeuler.openatom.cn/job/multiarch/openeuler/trigger/ubs-engine/8086/'},
                    {'id': 2, 'user': {'login': 'openeuler-bot'},
                     'body': 'https://log-ci.openeuler.openatom.cn/job/multiarch/openeuler/aarch64/ubs-engine/8084/'},
                    {'id': 3, 'user': {'login': 'someone'}, 'body': 'https://ci.openeuler.openatom.cn/job/fake/job/trigger/job/x/1/'},
                ]
        paths, comments = collect.discover_jobs(Client(), 'api', [{'number': 1765}], [])
        self.assertEqual(sorted(paths), ['multiarch/openeuler/aarch64/ubs-engine', 'multiarch/openeuler/trigger/ubs-engine'])
        self.assertEqual(paths['multiarch/openeuler/trigger/ubs-engine']['kind'], 'trigger')
        self.assertEqual(paths['multiarch/openeuler/trigger/ubs-engine']['evidence'][0]['pr'], 1765)
        self.assertEqual(paths['multiarch/openeuler/aarch64/ubs-engine']['kind'], 'arm')
        self.assertEqual(len(comments[1765]), 3)

    def test_legacy_ci_bot_reports_are_still_accepted(self):
        class Client:
            def pages(self, url):
                return [{'id': 9, 'user': {'login': 'openeuler-ci-bot'},
                         'body': 'https://ci.openeuler.openatom.cn/job/multiarch/job/openeuler/job/trigger/job/ham/40//console'}]
        paths, _ = collect.discover_jobs(Client(), 'api', [{'number': 18}], [])
        self.assertEqual(list(paths), ['multiarch/openeuler/trigger/ham'])


    def test_only_gate_bots_contribute_links_and_docs_jobs_are_dropped(self):
        self.assertIsNone(collect.bot_links({'user': {'login': 'wangwenlong7'},
                                             'body': 'https://ci.openeuler.openatom.cn/job/a/job/1/'}))
        self.assertEqual(collect.bot_links({'user': {'login': 'openeuler-bot'},
                                            'body': 'https://log-ci.openeuler.openatom.cn/job/multiarch/openeuler/trigger/ubs-engine/8086/'}),
                         {'https://ci.openeuler.openatom.cn/job/multiarch/job/openeuler/job/trigger/job/ubs-engine/8086/'})
        self.assertEqual(collect.bot_links({'user': {'login': 'openeuler-bot'},
                                            'body': 'https://ci.openeuler.openatom.cn/job/Infra/job/docs/job/openeuler-docs-ci-step2/23661//console'}), set())


    def test_a_single_build_report_owns_its_children_but_a_summary_does_not(self):
        prefix = 'https://ci.openeuler.openatom.cn/job/multiarch/job/openeuler/job/trigger/job/ubs-engine/'
        trigger = prefix + '8086/'
        child = 'https://ci.openeuler.openatom.cn/job/multiarch/job/openeuler/job/aarch64/job/ubs-engine/8084/'
        other = prefix + '8050/'
        table = ('<table><tr><td>trigger</td><td><a href=https://log-ci.openeuler.openatom.cn/job/multiarch/openeuler/trigger/'
                 'ubs-engine/8086/>#8086</a></td></tr><tr><td>aarch64</td><td><a href=https://log-ci.openeuler.openatom.cn/job/'
                 'multiarch/openeuler/aarch64/ubs-engine/8084/>#8084</a></td></tr></table>')
        comments = [
            {'user': {'login': 'openeuler-bot'}, 'body': '两条构建 ' + other + ' 与 ' + trigger},
            {'user': {'login': 'reviewer'}, 'body': 'https://ci.openeuler.openatom.cn/job/multiarch/job/openeuler/job/trigger/job/ubs-engine/8000/'},
        ]
        reports, triggers = collect.gate_reports(comments, [prefix])
        self.assertEqual(reports, {})
        self.assertEqual(triggers, {trigger, other})
        reports, triggers = collect.gate_reports([{'user': {'login': 'openeuler-bot'}, 'body': table}], [prefix])
        self.assertEqual(reports, {trigger: {child}})
        self.assertEqual(triggers, {trigger})
        reports, triggers = collect.gate_reports([], [prefix], [other])
        self.assertEqual((reports, triggers), ({}, {other}))


if __name__ == '__main__':
    unittest.main()
