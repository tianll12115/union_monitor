"""Fail closed unless changed executable production lines have >80% coverage."""
import argparse
import json
from pathlib import Path
import re
import subprocess

ROOT = Path(__file__).resolve().parents[1]


def changed_lines(diff):
    changes, path = {}, None
    for line in diff.splitlines():
        if line.startswith('+++ '):
            candidate = line[6:] if line.startswith('+++ b/') else ''
            path = candidate if (candidate.endswith(('.py', '.js', '.cjs', '.mjs'))
                                 and not candidate.startswith(('tests/', 'audit/', 'docs/'))) else None
        elif path and (match := re.match(r'@@ .* \+(\d+)(?:,(\d+))? @@', line)):
            start, count = int(match[1]), int(match[2] or 1)
            changes.setdefault(path, set()).update(range(start, start + count))
    return {path: lines for path, lines in changes.items() if lines}


def read_lcov(paths, root=ROOT):
    files, current = {}, None
    for report in paths:
        for line in Path(report).read_text(encoding='utf-8').splitlines():
            if line.startswith('SF:'):
                source = Path(line[3:].replace('\\', '/'))
                current = source.resolve().relative_to(root.resolve()).as_posix() if source.is_absolute() else source.as_posix()
                files.setdefault(current, {})
            elif current and line.startswith('DA:'):
                number, count, *_ = line[3:].split(',')
                number = int(number)
                files[current][number] = files[current].get(number, False) or int(count) > 0
            elif line == 'end_of_record':
                current = None
    return files


def evaluate(changes, measured):
    covered, total, uncovered = 0, 0, {}
    for path, lines in changes.items():
        if path not in measured:
            raise ValueError(f'No coverage evidence for changed file: {path}')
        for number in sorted(lines & measured[path].keys()):
            total += 1
            if measured[path][number]:
                covered += 1
            else:
                uncovered.setdefault(path, []).append(number)
    percent = 100 * covered / total if total else 100.0
    return {'passed': percent > 80, 'percent': percent, 'covered': covered,
            'executable_changed_lines': total, 'uncovered': uncovered}


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--base', default='main')
    parser.add_argument('--lcov', nargs='+', required=True)
    parser.add_argument('--output', default='test-results/changed-coverage.json')
    args = parser.parse_args(argv)
    try:
        diff = subprocess.check_output(['git', 'diff', '--merge-base', '--no-ext-diff', '--no-renames',
                                        '--unified=0', args.base, '--'], cwd=ROOT, text=True, encoding='utf-8')
        result = evaluate(changed_lines(diff), read_lcov(args.lcov))
        output = Path(args.output)
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
        print(json.dumps(result))
        return 0 if result['passed'] else 1
    except (OSError, ValueError, subprocess.CalledProcessError) as error:
        print(f'Changed coverage gate failed: {error}')
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
