# Union Monitor · 统一工程监控看板

> 聚合 openEuler UBS 九仓与 Triton-Ascend 的 PR 门禁数据，可观测**门禁耗时、失败批次、排队与来源证据**。

<p align="center">
  <a href="https://github.com/tianll12115/union_monitor/actions/workflows/pr-gate.yml"><img alt="CI" src="https://github.com/tianll12115/union_monitor/actions/workflows/pr-gate.yml/badge.svg"></a>
  <a href="https://github.com/tianll12115/union_monitor/actions/workflows/pages.yml"><img alt="Deploy" src="https://github.com/tianll12115/union_monitor/actions/workflows/pages.yml/badge.svg"></a>
</p>

## 这是什么

- **UBS**：覆盖 `ubs-engine`、`ubs-comm`、`ubs-virt`、`ubs-io`、`ubs-mem`、`OmniStateStore`、`ham`、`ubturbo`、`ubs-atomic` 九仓，最近 30 天的 GitCode / Jenkins 门禁。
- **Triton**：采集 [triton-lang/triton-ascend](https://github.com/triton-lang/triton-ascend) 最近 72 小时的 GitHub Actions 门禁。

代码目标仓库：[tianll12115/union_monitor](https://github.com/tianll12115/union_monitor)。

## 在线使用

| 入口 | 说明 |
|---|---|
| [工作台](https://tianli-backkom.github.io/union_monitor/#workbench) | 查看已加载快照并进入项目 |
| [UBS 跨仓总览](https://tianli-backkom.github.io/union_monitor/#ubs) | 九仓对比 → 单仓 PR → 批次与任务 |
| [Triton 看板](https://tianli-backkom.github.io/union_monitor/#triton) | E2E / NPU 排队趋势与关注批次 |

> 上为历史公开站点；新仓库部署验证通过后再切换到新地址。

## 快速开始

本地启动（需要 Python 3.12，网页运行不依赖 Node 包）：

```powershell
python -B scripts/devdata.py --offline    # 固定最小 fixture，无需访问源站
python serve.py --port 8765
```

打开 [http://127.0.0.1:8765/#workbench](http://127.0.0.1:8765/#workbench)，`Ctrl+C` 停止。服务只监听本机并仅公开 `web/`。

- 需要线上已发布快照时去掉 `--offline`：默认从 `union_monitor/data/` 读取 UBS 索引、各仓快照与 `triton.json`，不会重新采集 GitCode / GitHub。
- 使用细节与统计口径见 [使用指南](docs/user-guide.md)，手动采集见 [采集与运维](docs/operations.md)。

## 采集日程

| 流程 | 北京时间 | 范围 |
|---|---|---|
| [每日采集与发布](.github/workflows/pages.yml) | 07:30 | UBS 九仓 30 天 + Triton 72 小时 |
| [Triton 增量](.github/workflows/triton-refresh.yml) | 08:00/12:00/16:00/18:00/20:00 | 仅重采 Triton，复用已验证 UBS 快照 |

以上是启动日程而非更新时间保证；两流程共用 `pages` 并发组且 `cancel-in-progress: false`，排队中的运行遵循平台默认替换规则。迁移状态与目标态见 [采集与运维](docs/operations.md)。

## 文档

| 文档 | 说明 |
|---|---|
| [文档索引](docs/README.md) | 全部文档导航 |
| [使用指南](docs/user-guide.md) | 筛选、统计口径与导出 |
| [采集与运维](docs/operations.md) | 生产采集、迁移与手动采集 |
| [贡献指南](CONTRIBUTING.md) | 开发环境、PR 流程与 CI 门禁 |
| [产品方案](docs/design/2026-10-10-unified-dashboard-product.md) | 产品目标与迁移边界 |
| [技术方案](docs/design/2026-10-10-unified-dashboard-architecture.md) | 统一候选工件与目标架构 |
| [审查需求（38 项）](docs/requirements/2026-10-12-unified-dashboard-audit-requirements.md) | 验收规格；规格完整不代表业务验收通过 |

## 项目结构

| 位置 | 用途 |
|---|---|
| `collect.py`、`metrics.py`、`repository_store.py` | GitCode / Jenkins 采集与 UBS 统计 |
| `triton/` | GitHub Actions 采集、质量与部署验证 |
| `catalog.json`、`monitor/` | 项目配置、适配器与 shadow 统一采集 |
| `web/` | 当前网页与派生快照 |
| `tests/`、`scripts/verify_*.py` | Python、Node、Chromium 回归与独立审计 |

## 开发与验证

目标运行时为 **Python 3.12 / Node 22**。[PR 工作流](.github/workflows/pr-gate.yml) 汇总 Python、前端、采集契约与工作流语法四项检查，最终检查名为 `Dashboard quality gate`。创建 PR 前必须先执行 UT：

```powershell
python -B scripts/run_checks.py              # 完整 Python / Node UT
python -B scripts/run_checks.py --browser    # 追加 Chromium 回归
```

底层命令等价于：

```powershell
python -m pip install PyYAML==6.0.3
python -B scripts/devdata.py --offline
python -B -m unittest discover -s tests -v
node --test tests/*.test.cjs
npm ci --ignore-scripts
npx playwright install --with-deps chromium
npm run test:browser
```

安装 hook：`git config core.hooksPath .githooks`；提交脚本及合入条件见 [贡献指南](CONTRIBUTING.md)。

公开站点健康检查：

```powershell
python -B -m scripts.published_health
```

既有数据与需求审计（需先准备相应快照 / 证据）：

```powershell
python validate.py
python validate_bundle.py
python -X utf8 scripts/verify_interactions.py
python -X utf8 scripts/verify_freshness.py
python -X utf8 scripts/verify_acceptance.py --delivering REQ-051
python -X utf8 scripts/verify_requirements_doc.py
python -X utf8 -m triton.verify_deployment https://tianli-backkom.github.io/union_monitor/ --triton-manifest web/data/triton-manifest.json --ubs-manifest web/data/ubs-manifest.json
```

最后一条使用本地预期构建 manifest 对照线上文件；与仅使用线上 manifest 的健康检查不同。
