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
        [sys.executable, '-B', '-m', 'unittest', 'discover', '-s', 'tests', '-v'],
        ['node', '--test', *[str(p.relative_to(ROOT)).replace('\\', '/')
                            for p in sorted((ROOT / 'tests').glob('*.test.cjs'))]],
    ]
    if browser:
        result += [['npm', 'run', 'test:browser'],
                   [sys.executable, 'scripts/verify_basic_junit.py']]
    return result


def check(browser=False):
    for command in commands(browser):
        print('+ ' + ' '.join(command), flush=True)
        executable = shutil.which(command[0]) or command[0]
        subprocess.run([executable, *command[1:]], cwd=ROOT, check=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--browser', action='store_true',
                        help='also run installed Chromium and verify BASIC journeys')
    args = parser.parse_args()
    try:
        check(args.browser)
    except (subprocess.CalledProcessError, OSError) as error:
        print(f'Local checks failed: {error}', file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
