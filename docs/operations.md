# 采集与运维

生产采集日程、迁移状态与手动采集入口。只读使用说明见 [使用指南](user-guide.md)。

## 生产采集

当前生产使用两条流程，均可在 Actions 手动运行：

| 流程 | 北京时间计划启动 | 范围 |
|---|---|---|
| [每日采集与发布](../.github/workflows/pages.yml) | 07:30 | UBS 九仓最近 30 天 + Triton 最近 72 小时 |
| [Triton 增量](../.github/workflows/triton-refresh.yml) | 08:00/12:00/16:00/18:00/20:00 | 仅重采 Triton，复用经校验的 UBS 快照 |

这是启动日程，不是更新时间保证。两流程共用 `pages` 并发组且 `cancel-in-progress: false`，保护正在运行的构建；排队中的运行遵循平台默认替换规则（queue: single，同组仅保留最新排队运行）。构建门禁失败会阻止该构建进入部署；部署后的验证失败不会自动回滚。

[统一 shadow 流程](../.github/workflows/unified-shadow.yml) 仅手动生成候选工件，不部署 Pages。完整任务导航、统一数据版本发布、全站可信回退及自动回滚尚未上线；当前新路由提供已有项目能力的兼容入口，未提供的任务会明确说明。目标态与迁移约束见 [产品方案](design/2026-10-10-unified-dashboard-product.md)、[技术方案](design/2026-10-10-unified-dashboard-architecture.md)。

## 手动采集

```powershell
python -X utf8 collect.py --all --days 30           # UBS 九仓
python -X utf8 collect.py --repo ubs-comm --days 30 # UBS 单仓
python -X utf8 -m triton.dashboard --hours 72       # Triton，GH_TOKEN 用于 API 配额和强推历史查询
```

- UBS 的 `--offline` 从缓存重算，`--limit N` 用于诊断抽样；Triton 的 `--from-evidence` 从已存证据重生成。
- 原始缓存、SQLite 和历史导出不公开到 Pages。

## Triton 历史与恢复

Triton 的历史 PR 关联读取完整的强推事件分页，并通过 GitHub Compare 证明中间提交属于后续强推前的历史，同时排除基础分支共同祖先。恢复后保留原运行 SHA，按 PR、提交和 attempt 重新归并，进入 E2E 统计。真正缺少唯一证据的记录仍保留为未关联观测；网络、认证或配额错误会阻止本次刷新，不再冒充未关联数据发布。

每日和增量工作流无论成功或失败都保存 `triton-collection-*` 证据 7 天。可在修复分支手动运行 Triton 增量工作流验证真实采集与构建，仅 main 分支部署看板。

迁移到新仓库后，Triton 优先使用可选的 `GH_TOKEN` secret，未配置时使用该次工作流的 `github.token`。公开健康检查按当前仓库所有者和仓库名计算站点地址。每日流程同样只允许 main 部署；分支手动运行用于构建验证。Pages 需在仓库设置中选择 GitHub Actions，尚未发布时健康检查会如实失败。

## 迁移记录

维护与迁移的历史与其验证记录见 [维护与迁移记录](maintenance.md)。