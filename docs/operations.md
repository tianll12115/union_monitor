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

Triton 的历史 PR 关联读取完整的强推事件分页，并通过 GitHub Compare 证明中间提交属于后续强推前的历史，同时排除基础分支共同祖先。恢复后保留原运行 SHA，按 PR、提交和 attempt 重新归并，进入 E2E 统计。真正缺少唯一证据的记录仍保留为未关联观测；网络、认证或配额错误会阻止本次刷新，不再冒充未关联数据发布。关联还要求 PR 在 run 创建时仍处于打开状态（`closed_at` 不早于 run 创建时间）：同一分支上已关闭的旧 PR 不能与接替它的新 PR 同时匹配，否则会把这些批次误判为未关联。

统计窗口的结束点等于本轮创建发现截止（cutoff），不是采集完成时间；`collected_at` 记录实际观测时间，二者差值显示在页面边界说明中。窗口末尾新创建的 run 若发生在发现截止之后，属于下一轮窗口，不会出现“窗口声称覆盖到某时刻、该时刻之前创建的 run 却缺失”的缺口。发现从窗口起点前 90 天开始枚举；更早创建、且最新 attempt 已在窗口外的 run 不再进入候选，也不消耗 job 请求，避免重复 2026-11-13 的配额耗尽。建包前会对仍处于执行中的 run 再刷新一次状态：采集期间完成的按真实完成时间统计，仍在执行的按采集时刻记为观测值。Integration Tests 范围按工作流路径（`ci.yml` / `ascend-ci.yml`）判定；同名但路径未登记的工作流会阻断发布，而不是被静默当作辅助检查排除，工作流文件删除后重加导致的 id 变更也不会再让 E2E 断档。PR 归属存在多个候选时（例如两个打开的 PR 共用同一提交），记录保留全部候选并在页面与 CSV 缺口说明中列出，不猜测单一归属。

每日和增量工作流无论成功或失败都保存 `triton-collection-*` 证据 7 天。可在修复分支手动运行 Triton 增量工作流验证真实采集与构建，仅 main 分支部署看板。

迁移到新仓库后，Triton 优先使用可选的 `GH_TOKEN` secret，未配置时使用该次工作流的 `github.token`。公开健康检查按当前仓库所有者和仓库名计算站点地址。每日流程同样只允许 main 部署；分支手动运行用于构建验证。Pages 需在仓库设置中选择 GitHub Actions，尚未发布时健康检查会如实失败。

## 定时任务失败排查

- `Data quality gate failed`：先看本次 `quality-report.json` 的 `errors`。源时间戳倒置（job 完成早于开始、run 完成早于创建）属于上游数据缺陷，会按 `source_timestamp_inversion` 隔离该次观测并记 warning，不再阻断整轮发布；其余错误仍是发布阻断项，不得通过放宽门禁换取绿灯。
- `N workflow job lists could not be collected`：job 列表在重试（含被截断的响应体）后仍失败时，拒绝发布不完整刷新，`evidence/triton/collection-errors.json` 记录失败的 run 与原因。
- UBS 采集报 `HTTP Error 429`：GitCode 按来源 IP 做匿名限流，窗口以分钟计。采集客户端按 `Retry-After` 退避（没有该头时从 30 秒起阶梯递增，单次上限 120 秒）；整轮结束后对仍被限流的仓库冷却 120 秒再重试一次。仍失败时该仓库记为 failed 并保留上一份快照，完整性校验会让本次 workflow 失败、不发布缺仓刷新。
- 页面整仓 `0 批`、KPI 与明细全为 `—`：采集器只把 `openeuler-ci-bot` 与 `openeuler-bot` 发布的门禁报告当构建证据，并把 `log-ci.openeuler.openatom.cn` 的日志镜像链接归一化成 Jenkins API 地址。2026-11 起 UBSCore 门禁报告改由 `openeuler-bot` 发布且只带镜像链接，若上游再次更换账号或域名，需要同步 `collect.py` 的 `BOTS` / `LINK_RE`，否则所有 PR 都会退化成"未关联门禁"、页面只剩 PR 元数据。

## 迁移记录

维护与迁移的历史与其验证记录见 [维护与迁移记录](maintenance.md)。