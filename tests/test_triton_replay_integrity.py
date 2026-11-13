import copy
import unittest


class ReplayIntegrityTests(unittest.TestCase):
    def evidence(self):
        discovery = dict(mode='all_retained_runs', fetch_window_end='2026-11-10T00:00:00Z',
                         boundary_note='Retained source, not atomic.', enumerated_runs=2, candidate_runs=1, excluded_runs=1)
        ledger = dict(enumerated_runs=2, candidate_runs=1, excluded_runs=1, entries=[
            dict(id=1, run_attempt=1, candidate=True, reason='first_attempt_in_window'),
            dict(id=2, run_attempt=1, candidate=False, reason='first_attempt_before_display_window')])
        return dict(discovery=discovery), [dict(id=1, run_attempt=1)], ledger

    def test_replay_preserves_verified_bounds_and_counts(self):
        from triton.discovery import replay_discovery
        meta, rows, ledger = self.evidence()
        self.assertEqual(replay_discovery(meta, rows, ledger), meta['discovery'])

    def test_replay_cannot_claim_counts_when_source_identity_or_ledger_disappears(self):
        from triton.discovery import replay_discovery
        meta, rows, ledger = self.evidence()
        for bad in [None, {}, dict(ledger, candidate_runs=2),
                    dict(ledger, entries=ledger['entries'][:1]),
                    dict(ledger, entries=[ledger['entries'][0], ledger['entries'][0]])]:
            with self.subTest(ledger=bad), self.assertRaises(ValueError):
                replay_discovery(meta, rows, bad)
        with self.assertRaises(ValueError):
            replay_discovery(meta, [], ledger)
        meta['discovery']['enumerated_runs'] = 99
        with self.assertRaises(ValueError):
            replay_discovery(meta, rows, ledger)

    def test_replay_rejects_unknown_classifications(self):
        from triton.discovery import replay_discovery
        meta, rows, ledger = self.evidence()
        for field, value in [('candidate', None), ('reason', '')]:
            changed = copy.deepcopy(ledger)
            changed['entries'][0][field] = value
            with self.subTest(field=field), self.assertRaises(ValueError):
                replay_discovery(meta, rows, changed)
