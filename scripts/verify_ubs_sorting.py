"""REQ-043 · UBS排序与分页边界保持正确 — 保持验证工具。

审计期 A14、U18-created/batches/e2e、A08-0/15/16/31（含 U14–U17）已核对正确的
UBS 排序与分页语义，经 REQ-001..042 整改后须保持。本工具以独立重算（PR 代表值
复用 REQ-041 独立实现 verify_ubs_semantics，不导入生产 metrics/collect 代码）
对任意快照束（默认 web/data/）验收计算契约：

- PR 三种排序（代表 E2E 降序 / 批次数降序 / 创建时间降序；前两种并列按创建
  时间从新到旧，创建并列保持原序）完整序列与 web/core.js sortPRs 逐仓一致（AC01）
- 仓库排序：P90 降序（空→-1）使用独立重算 P90 值逐仓核对（A14 本质）；PR 数
  降序、名称 localeCompare 升序（独立侧以不区分大小写排序近似，当前 ASCII
  仓名下等价）（AC01）
- 分页数学：15 条/页，pages=max(1,ceil(n/15))，页码越界约束到合法页，全部页
  切片恰好划分序列、无重复遗漏；0/1/15/16/30/31 边界逐项核对（AC02/AC03）
- app.js 分页源码契约：pageSize 默认 15（可选 15/30/50）、ceil/min/slice 公式、
  上一/下一页禁用条件、空态提示、筛选/排序/耗时类型/页长切换回第一页、
  三种排序说明文案（AC02/AC03/AC04 的源码级锁定；浏览器级表现由审计 U14–U19
  与 REQ-048 回归覆盖）
- 指纹匹配审计冻结输入时回放 U18 三种排序首页 15 条、U15 第二页、U16 末页与
  5/5 页数、U17 筛选后 1/1、A08 六个边界与 A14 仓库 P90 顺序；输入更新后基线
  比对记 not_applicable，契约检查照常（不硬编码数量）

退出码：全部一致为 0；任何序列失配、排序值失配、源码契约缺失或执行错误为 1。
"""
import argparse
import json
import math
import subprocess
import sys
from datetime import datetime, timezone
from functools import cmp_to_key
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EVIDENCE_REL = Path('audit/2026-10-09/evidence')
REPORT_NAME = 'ubs-sorting-evidence.json'
BASELINE_BROWSER = EVIDENCE_REL / 'ubs-browser.json'
BASELINE_ADDITIONAL = EVIDENCE_REL / 'additional-browser.json'
AUDIT_BASELINE_FINGERPRINT = (
    'sha256:66f1da360414424006878e771a2bdf3f5922051ef2c0bf56385a4cb64593ec39')
PAGE_SIZE = 15
SORT_ORDERS = ('e2e', 'batches', 'submitted')
BOUNDARY_TOTALS = (0, 1, 15, 16, 30, 31)

sys.path.insert(0, str(Path(__file__).resolve().parent))
import verify_ubs_semantics as vsm  # noqa: E402 - 独立重算口径（非生产代码）

SOURCE_CONTRACTS = (
    ('page_size_15', 'pageSize=15'),
    ('pages_ceil', 'Math.max(1,Math.ceil(filtered.length/pageSize))'),
    ('page_clamp', 'page=Math.min(page,pages)'),
    ('rows_slice', 'filtered.slice((page-1)*pageSize,page*pageSize)'),
    ('prev_disabled', "$('prev').disabled=page<=1"),
    ('next_disabled', "$('next').disabled=page>=pages"),
    ('page_info_format', '${page} / ${pages}'),
    ('empty_state', '当前无匹配 PR，请调整筛选条件。'),
    ('label_e2e', '代表 E2E 从长到短；相同 E2E 按提交时间从新到旧'),
    ('label_batches', '批次数从多到少；相同批次数按提交时间从新到旧'),
    ('label_submitted', '提交时间从新到旧'),
    ('filter_resets_page', "page=1;render()"),
    ('prev_handler', "page--;render()"),
    ('next_handler', "page++;render()"),
    ('repo_sort_p90', '(b.metrics.e2e.p90??-1)-(a.metrics.e2e.p90??-1)'),
    ('repo_sort_prs', 'b.prs.length-a.prs.length'),
    ('repo_sort_name', 'a.name.localeCompare(b.name)'),
)


def stamp():
    return datetime.now(timezone.utc).isoformat()


def read_json(path):
    return json.loads(Path(path).read_text('utf-8'))


def own_paging(total, page=1, size=PAGE_SIZE):
    """独立分页模型：镜像 app.js renderTable 的页数/约束/禁用/切片数学。"""
    pages = max(1, math.ceil(total / size))
    page = min(page, pages)
    return {
        'total': total,
        'pages': pages,
        'page': page,
        'page_info': f'{page} / {pages}',
        'prev_disabled': page <= 1,
        'next_disabled': page >= pages,
        'rows_on_page': (min(page * size, total) - (page - 1) * size
                         if total else 0),
    }


def paging_partitions(total, size=PAGE_SIZE):
    """全部页切片恰好划分 [0, total)：无重复、无遗漏。"""
    pages = max(1, math.ceil(total / size))
    seen = []
    for page in range(1, pages + 1):
        seen.extend(range((page - 1) * size, min(page * size, total)))
    return seen == list(range(total))


def own_submission(p):
    """独立重算最近代码提交时间，镜像 web/core.js submissionValue。

    新快照显式字段优先；旧快照从原始 create/push 事件派生（legacy-observed）。
    retest/note/普通评论永不更新时间；{partial,unknown} 或操作日志采集失败
    视为未知（None）。"""
    if p.get('submission_time_profile') == 'ubs-latest-code-submission-v1':
        value = p.get('latest_submission_ms')
        return value if (type(value) in (int, float) and math.isfinite(value)
                         and value >= 0) else None
    if p.get('submission_events_status') in ('partial', 'unknown'):
        return None
    issues = p.get('issues') or []
    if any('操作日志采集失败' in str(item) for item in issues):
        return None
    best = None
    for event in p.get('events') or []:
        kind = event.get('kind')
        source = event.get('source') or (
            'PR.created_at' if kind == 'create' else
            'operate_logs' if kind == 'push' else kind)
        if (kind, source) not in {('create', 'PR.created_at'),
                                  ('push', 'operate_logs')}:
            continue
        value = event.get('time_ms')
        if (type(value) in (int, float) and math.isfinite(value)
                and value == int(value) and value >= 0
                and (best is None or value > best)):
            best = value
    return best


def _num_desc(a, b):
    """数值降序、空值最后；无空值时返回符号差。"""
    an = a if (type(a) in (int, float) and math.isfinite(a)) else None
    bn = b if (type(b) in (int, float) and math.isfinite(b)) else None
    if an is None and bn is None:
        return 0
    if an is None:
        return 1
    if bn is None:
        return -1
    return (bn > an) - (bn < an)


def _identity_tie(a, b):
    """提交时间并列时：PR 编号数值降序，再按完整源/仓/URL 身份稳定决胜。"""
    na = a.get('number')
    nb = b.get('number')
    left = na if na is not None else -math.inf
    right = nb if nb is not None else -math.inf
    if right != left:
        return (right > left) - (right < left)
    ra = str(a.get('repository') or '')
    rb = str(b.get('repository') or '')
    if ra != rb:
        return -1 if ra < rb else 1
    ua = str(a.get('url') or '')
    ub = str(b.get('url') or '')
    return (ua > ub) - (ua < ub)


def _cmp_pr(a, b, order):
    if order == 'batches':
        delta = len(b.get('batches') or []) - len(a.get('batches') or [])
        if delta:
            return (delta > 0) - (delta < 0)
        sub = _num_desc(own_submission(a), own_submission(b))
        if sub:
            return sub
        return _identity_tie(a, b)
    if order == 'submitted':
        sub = _num_desc(own_submission(a), own_submission(b))
        if sub:
            return sub
        return _identity_tie(a, b)
    e2e = _num_desc(vsm.representative(a)[0]['e2e_ms'],
                    vsm.representative(b)[0]['e2e_ms'])
    if e2e:
        return e2e
    sub = _num_desc(own_submission(a), own_submission(b))
    if sub:
        return sub
    return _identity_tie(a, b)


def own_sort_prs(prs, order='e2e'):
    """独立排序谓词：E2E/批次数降序，主值并列按提交时间降序（未知最后），
    再按 PR 编号降序与完整身份稳定决胜；镜像 web/core.js sortPRs。"""
    return sorted(prs, key=cmp_to_key(lambda a, b: _cmp_pr(a, b, order)))


def own_repo_rows(index, snapshots, state=''):
    """独立重算仓库行：参与仓 PR 经状态筛选后聚合，P90 取代表值分布。"""
    rows = []
    for entry in vsm.participation(index, snapshots):
        snap = snapshots.get(entry['name'])
        prs = (snap.get('prs') or []) if (snap and entry['participates']) else []
        filtered = [p for p in prs if not state or p.get('state') == state]
        aggregate = vsm.aggregate([vsm.representative(p)[0] for p in filtered])
        rows.append({'name': entry['name'], 'included': entry['participates'],
                     'prs': len(filtered), 'p90': aggregate['e2e']['p90']})
    return rows


def own_repo_orders(rows):
    p90 = sorted(rows, key=lambda r: (r['p90'] if r['p90'] is not None else -1),
                 reverse=True)
    prs = sorted(rows, key=lambda r: r['prs'], reverse=True)
    name = sorted(rows, key=lambda r: (r['name'].lower(), r['name']))
    return {'p90': [r['name'] for r in p90],
            'prs': [r['name'] for r in prs],
            'name': [r['name'] for r in name]}


def _bundle_fingerprint(root):
    if str(root) not in sys.path:
        sys.path.insert(0, str(root))
    import validate_bundle  # noqa: PLC0415 - 仓库根模块，按需导入
    return validate_bundle.verify(root)


def _node_sort_check(root):
    core = root / 'web' / 'core.js'
    if not core.exists():
        return {'status': 'skipped_no_web_core'}
    snippet = (
        "const fs=require('fs'),m=require('./web/core.js');"
        "const i=JSON.parse(fs.readFileSync('web/data/repositories.json','utf8'));"
        "const out={repos:{},repoRows:{}};"
        "for(const r of i.repositories){"
        "if(!r.snapshot)continue;"
        "const prs=JSON.parse(fs.readFileSync('web/data/'+r.snapshot,'utf8')).prs||[];"
        "out.repos[r.name]={"
        + ','.join(f"'{o}':m.sortPRs(prs,'{o}').map(p=>p.number)"
                   for o in SORT_ORDERS) + "};}"
        "const snaps=Object.fromEntries(i.repositories.filter(r=>r.snapshot)"
        ".map(r=>[r.name,JSON.parse(fs.readFileSync('web/data/'+r.snapshot,'utf8'))]));"
        "const rows=m.repositoryRows(i,snaps,'');"
        "out.repoRows.all=rows.map(r=>r.name);"
        "out.repoRows.p90=[...rows].sort((a,b)=>(b.metrics.e2e.p90??-1)"
        "-(a.metrics.e2e.p90??-1)).map(r=>r.name);"
        "out.repoRows.prs=[...rows].sort((a,b)=>b.prs.length-a.prs.length)"
        ".map(r=>r.name);"
        "out.repoRows.name=[...rows].sort((a,b)=>a.name.localeCompare(b.name))"
        ".map(r=>r.name);"
        "out.repoRows.p90Values=Object.fromEntries(rows.map("
        "r=>[r.name,r.metrics.e2e.p90]));"
        "console.log(JSON.stringify(out));"
    )
    try:
        proc = subprocess.run(['node', '-e', snippet], cwd=str(root),
                              capture_output=True, text=True, timeout=120)
    except (OSError, subprocess.SubprocessError) as error:
        return {'status': 'node_unavailable', 'error': repr(error)}
    if proc.returncode != 0:
        return {'status': 'node_failed', 'error': proc.stderr[-500:]}
    return {'status': 'ran', 'output': json.loads(proc.stdout)}


def _check_source_contracts(root):
    app_js = root / 'web' / 'app.js'
    if not app_js.exists():
        return {'app_js': 'missing', 'contracts': [], 'all_found': False}
    text = app_js.read_text('utf-8')
    contracts = []
    for name, pattern in SOURCE_CONTRACTS:
        found = pattern in text
        if name == 'filter_resets_page':
            found = text.count(pattern) >= 3  # 筛选/排序与耗时/重置三处回第一页
        contracts.append({'name': name, 'pattern': pattern, 'found': found})
    return {'app_js': 'present', 'contracts': contracts,
            'all_found': all(c['found'] for c in contracts)}


def build_report(root):
    problems = []
    index = read_json(root / 'web/data/repositories.json')
    snapshots = {e['name']: read_json(root / 'web/data' / e['snapshot'])
                 for e in index['repositories'] if e.get('snapshot')}

    # PR 排序独立重算 vs 生产 sortPRs（AC01）
    node = _node_sort_check(root)
    sort_mismatches = []
    py_sequences = {}
    if node['status'] != 'ran':
        problems.append(f"前端交叉核对未完成：{node['status']}")
    else:
        outj = node['output']
        for name, snap in snapshots.items():
            prs = snap.get('prs') or []
            py_sequences[name] = {
                order: [p['number'] for p in own_sort_prs(prs, order)]
                for order in SORT_ORDERS}
            node_sequences = outj['repos'].get(name)
            if node_sequences is None:
                problems.append(f'前端输出缺少仓库 {name}')
                continue
            for order in SORT_ORDERS:
                if py_sequences[name][order] != node_sequences.get(order):
                    sort_mismatches.append({'repo': name, 'order': order})

    # 仓库排序与 P90 独立重算值（AC01 / A14）
    repo_rows = own_repo_rows(index, snapshots)
    orders = own_repo_orders(repo_rows)
    p90_values = {row['name']: row['p90'] for row in repo_rows}
    repo_check = {'p90_order': {'python': orders['p90'], 'node': None, 'match': None},
                  'prs_order': {'python': orders['prs'], 'node': None, 'match': None},
                  'name_order': {'python': orders['name'], 'node': None, 'match': None},
                  'p90_values': {name: {'python': value, 'node': None, 'match': None}
                                 for name, value in p90_values.items()},
                  'name_collation_note': '名称排序契约为 localeCompare 升序；独立侧'
                                         '以不区分大小写排序近似，当前 ASCII 仓名等价'}
    if node['status'] == 'ran':
        outj = node['output']
        for key in ('p90', 'prs', 'name'):
            repo_check[f'{key}_order']['node'] = outj['repoRows'][key]
            repo_check[f'{key}_order']['match'] = (
                orders[key] == outj['repoRows'][key])
            if not repo_check[f'{key}_order']['match']:
                problems.append(f'仓库 {key} 排序与生产不一致')
        for name, value in p90_values.items():
            node_value = outj['repoRows']['p90Values'].get(name)
            repo_check['p90_values'][name]['node'] = node_value
            match = (value is None and node_value is None) or (
                value is not None and node_value is not None
                and math.isclose(value, node_value, rel_tol=1e-12, abs_tol=1e-6))
            repo_check['p90_values'][name]['match'] = match
            if not match:
                problems.append(f'{name} P90 独立重算与生产不一致')

    # 分页数学模型（AC02/AC03）
    boundaries = {}
    for total in BOUNDARY_TOTALS:
        info = own_paging(total)
        boundaries[total] = {'pages': info['pages'], 'page_info': info['page_info'],
                             'prev_disabled': info['prev_disabled'],
                             'next_disabled': info['next_disabled'],
                             'rows_on_page': info['rows_on_page']}
    coverage_ok = all(paging_partitions(total)
                      for total in list(range(0, 46)) + [68, 75, 76])
    clamp_ok = all(own_paging(total, page=total + 5)['page']
                   == own_paging(total)['pages'] for total in range(0, 46))
    if not coverage_ok:
        problems.append('分页切片未恰好划分序列')
    if not clamp_ok:
        problems.append('页码越界未约束到合法页')

    # app.js 分页源码契约（AC02/AC03/AC04 源码级锁定）
    contracts = _check_source_contracts(root)
    if not contracts['all_found']:
        missing = [c['name'] for c in contracts['contracts'] if not c['found']]
        problems.append(f'app.js 分页源码契约缺失：{missing}')

    if sort_mismatches:
        problems.append(f'PR 排序序列失配 {len(sort_mismatches)} 处')

    try:
        fingerprint, _digests, manifest_state, bundle_errors = _bundle_fingerprint(root)
    except Exception as error:  # noqa: BLE001 - 指纹失败如实记录
        fingerprint, manifest_state, bundle_errors = None, f'error: {error!r}', []
    if bundle_errors:
        problems.append(f'快照束完整性错误 {bundle_errors}')
    matches_baseline = fingerprint == AUDIT_BASELINE_FINGERPRINT

    baseline = {'status': 'not_applicable_input_drifted'}
    if matches_baseline:
        browser = read_json(root / BASELINE_BROWSER)
        additional = read_json(root / BASELINE_ADDITIONAL)
        engine = snapshots['ubs-engine'].get('prs') or []
        seq = {order: [p['number'] for p in own_sort_prs(engine, order)]
               for order in SORT_ORDERS}
        u18 = {}
        for check in browser.get('checks', []):
            if check['id'].startswith('U18-') and check['state'] == 'passed':
                order = check['id'].split('-', 1)[1]
                u18[order] = {'computed': seq[order][:15],
                              'baseline': check['expected'],
                              'match': seq[order][:15] == check['expected']}
        u15_check = next((c for c in browser['checks'] if c['id'] == 'U15'
                          and c['state'] == 'passed'), None)
        u15 = ({'computed': seq['e2e'][15:30], 'baseline': u15_check['expected'],
                'match': seq['e2e'][15:30] == u15_check['expected']}
               if u15_check else None)
        u16_check = next((c for c in browser['checks'] if c['id'] == 'U16'
                          and c['state'] == 'passed'), None)
        u16 = None
        if u16_check:
            base = own_paging(len(engine))
            info = own_paging(len(engine), page=base['pages'])
            last = seq['e2e'][(base['pages'] - 1) * PAGE_SIZE:]
            u16 = {'pages': {'computed': info['pages'], 'baseline': 5},
                   'page_info': {'computed': info['page_info'],
                                 'baseline': u16_check['expected']['page']},
                   'next_disabled': {'computed': info['next_disabled'],
                                     'baseline': u16_check['expected']['next']},
                   'last_page_rows': {'computed': last,
                                      'baseline': u16_check['expected']['rows']},
                   'match': (info['page_info'] == u16_check['expected']['page']
                             and info['next_disabled'] == u16_check['expected']['next']
                             and last == u16_check['expected']['rows'])}
        u14_check = next((c for c in browser['checks'] if c['id'] == 'U14'), None)
        u14 = ({'computed': own_paging(len(engine))['prev_disabled'],
                'baseline': u14_check['expected'],
                'match': own_paging(len(engine))['prev_disabled']
                == u14_check['expected']} if u14_check else None)
        u17_check = next((c for c in browser['checks'] if c['id'] == 'U17'), None)
        u17 = ({'computed': own_paging(1)['page_info'],
                'baseline': u17_check['expected'],
                'match': own_paging(1)['page_info'] == u17_check['expected']}
               if u17_check else None)
        a08 = {}
        for check in additional.get('checks', []):
            if check['id'].startswith('A08-') and check['state'] == 'passed':
                total = int(check['id'].split('-', 1)[1])
                info = own_paging(total)
                a08[total] = {'count': {'computed': total,
                                        'baseline': check['expected']['count']},
                              'page_info': {'computed': info['page_info'],
                                            'baseline': check['expected']['page']},
                              'next_disabled': {
                                  'computed': info['next_disabled'],
                                  'baseline': check['expected']['next']},
                              'match': (total == check['expected']['count']
                                        and info['page_info'] == check['expected']['page']
                                        and info['next_disabled']
                                        == check['expected']['next'])}
        a14_check = next((c for c in additional['checks'] if c['id'] == 'A14'
                          and c['state'] == 'passed'), None)
        a14 = ({'computed': orders['p90'], 'baseline': a14_check['expected'],
                'match': orders['p90'] == a14_check['expected']} if a14_check else None)
        replay_ok = (all(v['match'] for v in u18.values()) and u15 and u15['match']
                     and u16 and u16['match'] and u14 and u14['match']
                     and u17 and u17['match'] and a08 and all(v['match']
                                                              for v in a08.values())
                     and a14 and a14['match'])
        baseline = {'status': 'matched' if replay_ok else 'mismatched',
                    'u18': u18, 'u15': u15, 'u16': u16, 'u14': u14, 'u17': u17,
                    'a08': a08, 'a14': a14}
        if baseline['status'] != 'matched':
            problems.append('审计基线回放失配（U14–U18/A08/A14）')

    report = {
        'requirement': 'REQ-043',
        'generated_at': stamp(),
        'input': {
            'repositories': list(snapshots),
            'repos_checked': len(snapshots),
            'bundle_fingerprint': fingerprint,
            'manifest_state': manifest_state,
            'matches_audit_frozen_input': matches_baseline,
        },
        'pr_sorting': {
            'orders': list(SORT_ORDERS),
            'sequences_compared': len(snapshots) * len(SORT_ORDERS),
            'mismatches': sort_mismatches,
            'mismatch_count': len(sort_mismatches),
            'per_repo': py_sequences,
        },
        'repo_sorting': repo_check,
        'pagination_model': {
            'page_size': PAGE_SIZE,
            'boundaries': boundaries,
            'coverage_verified': coverage_ok,
            'clamp_verified': clamp_ok,
            'note': '0 条时页码 1/1 且无记录；全部页切片恰好划分序列、无重复遗漏；'
                    '越界页码约束到合法页',
        },
        'source_contracts': contracts,
        'audit_baseline_comparison': baseline,
        'overall': {'status': 'verified' if not problems else 'failed',
                    'problems': problems},
    }
    return report, not problems


def main(argv=None):
    parser = argparse.ArgumentParser(
        description='REQ-043 UBS排序与分页边界保持正确 — 保持验证工具')
    parser.add_argument('--root', default=str(ROOT), help='仓库根目录')
    parser.add_argument('--output', default=None, help='报告输出路径')
    args = parser.parse_args(argv)
    root = Path(args.root).resolve()
    output = (Path(args.output).resolve() if args.output
              else root / EVIDENCE_REL / REPORT_NAME)
    try:
        report, ok = build_report(root)
    except Exception as error:  # noqa: BLE001 - 执行错误如实入报告
        print(json.dumps({'requirement': 'REQ-043', 'error': repr(error)},
                         ensure_ascii=False))
        return 1
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', 'utf-8')
    repo_sorting = report['repo_sorting']
    print(json.dumps({
        'overall_status': report['overall']['status'],
        'repos': report['input']['repos_checked'],
        'sequences_compared': report['pr_sorting']['sequences_compared'],
        'sort_mismatches': report['pr_sorting']['mismatch_count'],
        'repo_orders_match': {k: repo_sorting[f'{k}_order']['match']
                              for k in ('p90', 'prs', 'name')},
        'p90_values_match': all(v['match'] for v
                                in repo_sorting['p90_values'].values()),
        'boundaries': {str(k): v['page_info'] for k, v
                       in report['pagination_model']['boundaries'].items()},
        'coverage_verified': report['pagination_model']['coverage_verified'],
        'clamp_verified': report['pagination_model']['clamp_verified'],
        'source_contracts_all_found': report['source_contracts']['all_found'],
        'baseline': report['audit_baseline_comparison']['status'],
        'matches_audit_frozen_input': report['input']['matches_audit_frozen_input'],
        'problems': report['overall']['problems'],
        'report': str(output),
    }, ensure_ascii=False))
    return 0 if ok else 1


if __name__ == '__main__':
    sys.exit(main())
