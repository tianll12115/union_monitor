"""Validate coverage and evidence integrity of the dated requirements audit.

This verifies report structure and references, not the truth of engineering
judgments or whether product requirements are implemented.
"""
import argparse
import hashlib
import json
import re
import subprocess
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SPEC_FILES = (
    '2026-10-12-unified-dashboard-audit-requirements.md',
    '2026-10-21-dashboard-user-audit.md',
    '2026-10-21-engineering-capability-dashboard.md',
    '2026-10-22-pr-submission-sort-and-quality-gate.md',
)
STATUSES = {'complete', 'partial', 'not_complete', 'unverified', 'superseded', 'deferred'}


def source_hash(path):
    return normalized_hash(Path(path).read_bytes())


def normalized_hash(raw):
    try:
        raw = raw.decode('utf-8-sig').replace('\r\n', '\n').encode('utf-8')
    except UnicodeDecodeError:
        pass
    return hashlib.sha256(raw).hexdigest()


def requirement_index(root, read_bytes=None):
    index = {}
    for filename in SPEC_FILES:
        relative = 'docs/requirements/' + filename
        text = (read_bytes(relative) if read_bytes else (Path(root) / relative).read_bytes()).decode('utf-8-sig')
        sections = list(re.finditer(r'^### ((?:UDR|UAR|EC|PSG)-\d{3})[：:]', text, re.M))
        for i, match in enumerate(sections):
            identifier = match.group(1)
            if identifier in index:
                raise ValueError(f'duplicate canonical requirement {identifier}')
            section = text[match.start():sections[i + 1].start() if i + 1 < len(sections) else len(text)]
            index[identifier] = set(re.findall(re.escape(identifier) + r'-AC\d{2}', section))
    return index


def validate_audit(ledger, root, report_text=None):
    root = Path(root).resolve()
    errors = []
    baseline = ledger.get('baseline', '')
    available = subprocess.run(['git', 'cat-file', '-t', baseline], cwd=root,
                               capture_output=True, text=True).stdout.strip() == 'commit' if re.fullmatch(r'[0-9a-f]{40}', baseline) else False
    contents = {}

    def read_bytes(value):
        relative = str(value).replace('\\', '/')
        path = (root / relative).resolve()
        if not path.is_relative_to(root):
            raise ValueError(relative)
        if relative not in contents:
            historic = subprocess.run(['git', 'show', f'{baseline}:{relative}'], cwd=root,
                                      capture_output=True) if available else None
            contents[relative] = historic.stdout if historic is not None and historic.returncode == 0 else path.read_bytes()
        return contents[relative]

    expected = requirement_index(root, read_bytes)
    if ledger.get('schema_version') != 1 or not re.fullmatch(r'[0-9a-f]{40}', ledger.get('baseline', '')):
        errors.append('invalid schema_version or baseline')
    rows = ledger.get('requirements', [])
    ids = [row.get('id') for row in rows]
    if set(ids) != set(expected) or len(ids) != len(set(ids)):
        errors.append('requirements missing, unknown or duplicated')
    if not ledger.get('inputs'):
        errors.append('missing source fingerprints')
    line_counts = {}

    def safe_path(value):
        path = (root / str(value)).resolve()
        if not path.is_relative_to(root):
            raise ValueError(str(value))
        return path

    def check_evidence(evidence, label):
        if not isinstance(evidence, list) or not evidence:
            errors.append(f'{label}: evidence missing')
            return
        for item in evidence:
            try:
                path = safe_path(item['path'])
                line = item['line']
                if path not in line_counts:
                    raw = read_bytes(item['path'])
                    if path.suffix.lower() in {'.png', '.jpg', '.jpeg', '.webp'}:
                        line_counts[path] = 1
                    else:
                        line_counts[path] = max(1, len(raw.decode('utf-8-sig').splitlines()))
                if isinstance(line, bool) or not isinstance(line, int) or not 1 <= line <= line_counts[path]:
                    raise ValueError(f'line {line}')
                if not item.get('note'):
                    raise ValueError('missing evidence explanation')
            except (KeyError, ValueError, OSError, UnicodeDecodeError) as error:
                errors.append(f'{label}: invalid evidence {item!r}: {error}')

    for filename, fingerprint in ledger.get('inputs', {}).items():
        try:
            safe_path(filename)
            if normalized_hash(read_bytes(filename)) != fingerprint:
                errors.append(f'source changed: {filename}')
        except (OSError, ValueError):
            errors.append(f'source unavailable: {filename}')
    for row in rows:
        identifier = row.get('id')
        acs = row.get('acs', [])
        ac_ids = [ac.get('id') for ac in acs]
        if set(ac_ids) != expected.get(identifier, set()) or len(ac_ids) != len(set(ac_ids)):
            errors.append(f'{identifier}: acceptance criteria missing, unknown or duplicated')
        if row.get('status') not in STATUSES or row.get('scope') not in {'current', 'historical', 'deferred'}:
            errors.append(f'{identifier}: invalid status or scope')
        reason = row.get('reasonableness', {})
        if not row.get('summary') or not all(reason.get(key) for key in ('judgement', 'reason', 'recommendation')):
            errors.append(f'{identifier}: missing judgment or user rationale')
        if row.get('status') == 'complete' and any(ac.get('status') != 'complete' for ac in acs):
            errors.append(f'{identifier}: false closure over incomplete criteria')
        if report_text is not None and f'### {identifier}：' not in report_text:
            errors.append(f'{identifier}: report section missing')
        for ac in acs:
            if ac.get('status') not in STATUSES or not ac.get('detail'):
                errors.append(f"{ac.get('id')}: missing conclusion")
            check_evidence(ac.get('evidence'), ac.get('id'))
            if report_text is not None and ac.get('id', '') not in report_text:
                errors.append(f"{ac.get('id')}: report entry missing")
    for finding in ledger.get('findings', []):
        if finding.get('priority') not in {'P0', 'P1', 'P2', 'P3'}:
            errors.append(f"{finding.get('id')}: invalid priority")
        if not set(finding.get('requirement_ids', [])).issubset(expected):
            errors.append(f"{finding.get('id')}: unknown requirement mapping")
        check_evidence(finding.get('evidence'), finding.get('id'))
    return errors


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--ledger', type=Path, default=ROOT / 'docs/reviews/2026-10-23-requirements-audit.json')
    parser.add_argument('--report', type=Path, default=ROOT / 'docs/reviews/2026-10-23-adversarial-requirements-audit.md')
    args = parser.parse_args(argv)
    ledger = json.loads(args.ledger.read_text('utf-8-sig'))
    errors = validate_audit(ledger, ROOT, args.report.read_text('utf-8-sig'))
    result = {'passed': not errors, 'requirements': len(ledger['requirements']),
              'acceptance_criteria': sum(len(r['acs']) for r in ledger['requirements']),
              'requirement_statuses': dict(Counter(r['status'] for r in ledger['requirements'])),
              'errors': errors}
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return int(bool(errors))


if __name__ == '__main__':
    raise SystemExit(main())
