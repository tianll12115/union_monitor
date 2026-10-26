"""Run UT on committed code before pushing a feature branch and opening a PR."""
import argparse
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def run(command):
    if 'scripts/run_checks.py' in command:
        subprocess.run(command, cwd=ROOT, check=True)
        return ''
    result = subprocess.run(command, cwd=ROOT, check=True, text=True,
                            stdout=subprocess.PIPE)
    return result.stdout.strip()


def submit(title, body_file, remote='origin'):
    branch = run(['git', 'branch', '--show-current'])
    if not branch or branch == 'main':
        raise ValueError('Create a feature branch; main and detached HEAD are forbidden')
    if run(['git', 'status', '--porcelain']):
        raise ValueError('Commit changes and resolve untracked files before submitting')
    head = run(['git', 'rev-parse', 'HEAD'])
    # Stream test output so a failure is visible and cannot reach push/create.
    run([sys.executable, '-u', 'scripts/run_checks.py', '--browser'])
    if run(['git', 'status', '--porcelain']):
        raise ValueError('Tests changed tracked or untracked files; review and commit first')
    final_head = run(['git', 'rev-parse', 'HEAD'])
    final_branch = run(['git', 'branch', '--show-current'])
    if final_head != head or final_branch != branch:
        raise ValueError('HEAD or branch changed during UT; retry before submitting')
    run(['git', 'push', remote, f'{head}:refs/heads/{branch}'])
    repository = run(['git', 'remote', 'get-url', remote])
    print(run(['gh', 'pr', 'create', '--base', 'main', '--head', branch,
               '--title', title, '--body-file', str(Path(body_file).resolve()),
               '--repo', repository]))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--title', required=True)
    parser.add_argument('--body-file', required=True)
    parser.add_argument('--remote', default='origin')
    args = parser.parse_args()
    try:
        submit(args.title, args.body_file, args.remote)
    except (ValueError, OSError, subprocess.CalledProcessError) as error:
        print(f'PR submission stopped: {error}', file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
