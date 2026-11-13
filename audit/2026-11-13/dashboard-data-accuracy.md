# 看板数据准确性审计（2026-11-13）

> 目标：看板上每个数字必须与源证据一致，且声明窗口内的记录不得遗漏。
> 对象：<https://tianll12115.github.io/union_monitor/#projects/triton/engineering>（Triton 工程视图）。
> 机器可读证据：[dashboard-data-accuracy.json](dashboard-data-accuracy.json)。

## 方法

1. 以页面快照的声明窗口 `2026-11-10T06:09:23Z .. 2026-11-13T06:09:23Z` 为基准，用 GitHub REST 枚举该窗口内**所有** PR 事件 run（2050 条最新 attempt，含 45 条重跑），并拉取全部 216 条 Integration Tests 首跑与 13 条重跑的 job 列表（243 次请求，948 个 job）。
2. 把源集合与已发布 `triton.json` 的 `(run_id, attempt)` 逐一比对，统计缺失、范围误判、PR 关联和时长资格。
3. 对用户链接选中的 59 小时子窗口（`1794290963000..1794503636000`）独立复算 E2E 样本量与分位数。
4. 用真实 job/step 时间分布检验“时间线矛盾”隔离规则是否产生误杀。

## 结论（已发布快照）

| 指标 | 看板显示 | 源证据 | 偏差原因 |
|---|---|---|---|
| 窗口内 run | 2044 / 2050 | 2050 | 发现截止 05:47:26Z，窗口却声明到 06:09:23Z，缺 7 条 06:06 创建的 run（含 1 条 Integration Tests） |
| Integration Tests 批次 | 29 | 241（含历史 attempt） | 只登记了 `241783889/ci.yml`，把 `348219361/ascend-ci.yml` 的 191 条首跑当作“辅助检查”，其中 147 条本应计入 E2E |
| 全窗口有效 E2E 样本 | 16 | 163 | 同上；中位数 4448.5s → 1499s，P90 5439s → 4381s |
| 用户子窗口 E2E | n=15, P50 4534s, P90 5440s | n=151, P50 1466s, P90 4385s | 同上，另加 1 条可恢复的未关联样本 |
| 未关联 PR run | 46 | 33 条确实无法唯一确定 | 已关闭 PR 仍参与匹配：PR 3084 关闭 85 秒后创建的 run 仍同时匹配 3084/3085 |

### 另两个“未上线但已在 main”的缺陷

- **步骤时间容差缺失。** 当前 main 把任何落在 job 时钟之外的 step 视为矛盾证据。实测 GitHub 会在 `completed_at` 之后 0–169 秒继续记录 post-job steps，并在 `started_at` 之前最多 35 秒记录 “Set up job”。按该规则，228 条首跑中有 151 条会被误隔离，可用样本从 156 降到 38。已加入 300 秒的 runner 收尾容差，只隔离真正越界（超过 5 分钟）或自身倒置的 step。
- **发布链路静默过期。** 两次合并触发的 `Collect and deploy dashboard`（43381673738、43384499390）都在 UBS 采集阶段被取消，页面一直停留在 06:09 的旧代码产物。代码修复必须伴随一次成功的采集与部署验证，否则线上数字不会改变。

## 修复

| 区域 | 变更 |
|---|---|
| `triton/run_e2e.py` | Integration Tests 范围改为**工作流路径**判定（`ci.yml`、`ascend-ci.yml`），id 作为一致性校验；新增 300 秒 step 收尾容差 |
| `triton/quality.py` | 选择窗口（`window_end`）与观测时刻（`collected_at`）分离；路径范围独立校验；已登记 id 报告不同路径时阻断发布 |
| `triton/dashboard.py` | 窗口结束点等于创建发现截止，不再延伸到采集完成；建包前刷新仍在执行的 run，避免把“采集期间已完成”记成超长运行 |
| `triton/pr_identity.py` | PR 必须在 run 创建时仍处于打开状态（`closed_at` 不早于 run 创建） |
| 文档 | `docs/triton-e2e-v2.md`、`docs/operations.md`、`docs/user-guide.md` 同步口径 |

## 回归与验证

- 新增/更新 UT：窗口截止与观测分离、执行中 run 刷新、路径范围与 id 漂移、关闭 PR 排除、step 容差（含 PR3097 真实源 fixture 由“隔离”改为可测量 5350 秒）。
- 全量 Python 1129 项、Node 372 项通过；改动行覆盖率见 `scripts/verify_changed_coverage.py` 输出（要求 >80%）。
- 部署后须复核：`window_end == discovery.fetch_window_end`、Integration Tests 样本数回到约 150+、未关联 run 从 46 降到 33 左右、`npu_points` 与之前同量级。
