"""Run the full local unit gate, optionally followed by real browser checks."""
import argparse
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def commands(browser=False):
    result = [
        [sys.executable, '-c', 'import yaml'],
        [sys.executable, '-B', 'scripts/devdata.py', '--offline'],
        [sys.executable, '-B', '-m', 'coverage', 'run', '--data-file=.tmp/python-coverage/.coverage',
         '-m', 'unittest', 'discover', '-s', 'tests', '-v'],
        ['node', '--test', *[str(p.relative_to(ROOT)).replace('\\', '/')
                            for p in sorted((ROOT / 'tests').glob('*.test.cjs'))]],
    ]
    if browser:
        result += [['npm', 'run', 'test:browser'],
                   [sys.executable, 'scripts/verify_basic_junit.py']]
    verify = [sys.executable, 'scripts/verify_changed_coverage.py', '--lcov',
              'test-results/python.lcov', 'test-results/node-coverage/lcov.info']
    if browser:
        verify.append('test-results/browser-coverage/lcov.info')
    result += [
        [sys.executable, '-m', 'coverage', 'lcov', '--data-file=.tmp/python-coverage/.coverage',
         '-o', 'test-results/python.lcov'],
        ['npm', 'exec', '--', 'c8', '--all', '--include=web/*.js', '--reporter=lcovonly',
         '--reports-dir=test-results/node-coverage', 'node', '--test',
         *[str(p.relative_to(ROOT)).replace('\\', '/') for p in sorted((ROOT / 'tests').glob('*.test.cjs'))]],
        verify,
    ]
    return result


def check(browser=False):
    for command in commands(browser):
        print('+ ' + ' '.join(command), flush=True)
        executable = shutil.which(command[0]) or command[0]
        subprocess.run([executable, *command[1:]], cwd=ROOT, check=True)


def git_output(*args):
    return subprocess.check_output(['git', *args], cwd=ROOT, text=True).strip()


def verify_push_refs(records, head):
    for record in records:
        fields = record.split()
        if len(fields) != 4:
            raise ValueError('Malformed pre-push ref record')
        _, local_sha, remote_ref, _ = fields
        if remote_ref == 'refs/heads/main':
            raise ValueError('Direct pushes to main are forbidden; submit a PR')
        if local_sha != '0' * len(head) and local_sha != head:
            raise ValueError('Only the checked-out, tested HEAD may be pushed')


def pre_push(records):
    head = git_output('rev-parse', 'HEAD')
    branch = git_output('branch', '--show-current')
    dirty = git_output('status', '--porcelain')
    if dirty:
        raise ValueError('Commit changes and resolve untracked files before pushing')
    verify_push_refs(records, head)
    check(browser=True)
    final_head = git_output('rev-parse', 'HEAD')
    final_branch = git_output('branch', '--show-current')
    dirty = git_output('status', '--porcelain')
    if final_head != head or final_branch != branch or dirty:
        raise ValueError('Repository changed during UT; retry on a clean, fixed HEAD')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--browser', action='store_true',
                        help='also run installed Chromium and verify BASIC journeys')
    parser.add_argument('--pre-push', action='store_true', help='validate Git hook refs and tested HEAD')
    args = parser.parse_args()
    try:
        if args.pre_push:
            pre_push(sys.stdin.read().splitlines())
        else:
            check(args.browser)
    except (subprocess.CalledProcessError, OSError, ValueError) as error:
        print(f'Local checks failed: {error}', file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
