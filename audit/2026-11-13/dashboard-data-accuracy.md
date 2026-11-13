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
| 全窗口有效 E2E 样本 | 16 | 163（同快照重算）；166（重新采集后线上） | 同上；中位数 4448.5s → 1499s，P90 5439s → 4381s |
| 用户子窗口 E2E | n=15, P50 4534s, P90 5440s | n=151, P50 1466s, P90 4385s | 同上，另加 1 条可恢复的未关联样本 |
| 未关联 PR run | 46 | 33 条确实无法唯一确定 | 已关闭 PR 仍参与匹配：PR 3084 关闭 85 秒后创建的 run 仍同时匹配 3084/3085 |

### 另两个“未上线但已在 main”的缺陷

- **步骤时间容差缺失。** 当前 main 把任何落在 job 时钟之外的 step 视为矛盾证据。实测 GitHub 会在 `completed_at` 之后 0–169 秒继续记录 post-job steps，并在 `started_at` 之前最多 35 秒记录 “Set up job”。按该规则，228 条首跑中有 151 条会被误隔离，可用样本从 156 降到 38。已加入 300 秒的 runner 收尾容差，只隔离真正越界（超过 5 分钟）或自身倒置的 step。
- **发布链路静默过期。** 两次合并触发的 `Collect and deploy dashboard`（43381673738、43384499390）都在 UBS 采集阶段被取消，页面一直停留在 06:09 的旧代码产物。

### 首次部署失败复盘（19:18 CST）

合并后触发的部署（43399530611）在 Triton 采集阶段运行 125 分钟后失败：发现阶段枚举出 **3745 条候选**（约为窗口 run 总数的 1.8 倍），逐个拉取 job 时耗尽 5000 次/小时令牌配额，1717 个 job 列表失败，门禁按设计拒绝发布。根因是“完整创建历史”发现把历史上所有 `attempt>1` 的 run 都当成候选。

修复：发现窗口改为 `[窗口起点-90 天, 发现截止]`，并把候选条件收紧为“当前 attempt 起点在窗口内”（attempt 按时间递增，最新 attempt 早于窗口就不可能有更早 attempt 落在窗口内）。历史重跑不再逐个拉取 job，候选回到窗口量级（约 2100），整轮调用约 3300 次，留出配额余量。窗口内新创建 run 与 90 天内重跑 run 的完整性不受影响。

随后，live-data 契约测试仍按旧口径用 `window_end` 替代执行中批次的 `end_at`，把正确的观测时长（`collected_at - start`）判成错误；已改为按观测时刻校验（PR #22）。

### 部署结果（21:14 CST）

`Collect and deploy dashboard`（run 43426713115）成功，线上快照：

| 项 | 值 |
|---|---|
| `collected_at` | 2026-11-13T13:11:07Z |
| 统计窗口 | 2026-11-10T12:48:20Z .. 2026-11-13T12:48:20Z |
| `window_end == discovery.fetch_window_end` | 是 |
| manifest 指纹与 payload 一致 | 是 |
| 批次 / PR | 2241 / 101 |
| 有效 E2E 样本 | **166**（修复前 16） |
| 未关联 PR 批次 | **33**（修复前 46；其中 25 条已发布候选 PR） |
| NPU 点数 | 289 |
| 本轮 API 调用 | 3038（配额内） |

用户原链接的选区因快照窗口前移被裁剪到 `2026-11-10T12:48:20Z .. 2026-11-12T17:13:56Z`，该选区为 **n=128，P50=1525.5s，P90=4574.8s**（修复前同一选区 n=15、P50=4534s、P90=5440s）。页面会显示快照更新、选区被裁剪的提示。

CSV、`triton-qualifications-v1.json`、manifest 与 payload 的一致性复核：0 个问题（`verify_artifacts`）。

### PR 身份：把“未关联”变成可核对的候选

已发布快照的 33 条未关联记录中：

- **25 条**同属两个打开的 PR（#3051、#3011）共用的同一批提交（`e3a7eb97`、`a5137993` 等）。此前只写“未关联 PR”；现在记录 `pr_candidates=[3011, 3051]`，详情卡与 CSV 缺口说明列出两个真实 PR 链接，并明确“不猜测单一归属”。按 UDR-001 口径，它们仍不进入按 PR 统计的 E2E；其中 1 条有效时长观测在页面单独计数“未计入 KPI”，不隐藏。
- **8 条**没有任何可证实候选（多为 `pull_request_target` 的基线提交或已删除来源）。保留“未关联 PR”，不生成伪链接。
- 无 PR 时标题回退到源 run 的 `display_title`（例如 “[WIP][test] test never merge”），不再一律“标题未获取”。

## 修复

| 区域 | 变更 |
|---|---|
| `triton/run_e2e.py` | Integration Tests 范围改为**工作流路径**判定（`ci.yml`、`ascend-ci.yml`），id 作为一致性校验；新增 300 秒 step 收尾容差 |
| `triton/quality.py` | 选择窗口（`window_end`）与观测时刻（`collected_at`）分离；路径范围独立校验；已登记 id 报告不同路径时阻断发布 |
| `triton/dashboard.py` | 窗口结束点等于创建发现截止，不再延伸到采集完成；建包前刷新仍在执行的 run；90 天重跑回溯；批次保留 `pr_candidates` 与 `display_title` |
| `triton/discovery.py` | 候选条件改为“当前 attempt 起点在窗口内”，历史重跑不再逐个拉取 job，避免配额耗尽；覆盖 attempt 跨度跨窗的防御分支 |
| `triton/pr_identity.py` | PR 必须在 run 创建时仍处于打开状态；多候选时抛出携带全部候选的 `AmbiguousPRIdentity`，不猜测单一归属 |
| 前端 | 详情卡/标记展示候选 PR 链接与“不猜测单一归属”；样本账本区分“未关联”与“多候选”，并单独计数未计入 KPI 的有效观测 |
| 文档 | `docs/triton-e2e-v2.md`、`docs/operations.md`、`docs/user-guide.md` 同步口径 |

## 回归与验证

- 新增/更新 UT：窗口截止与观测分离、执行中 run 刷新、路径范围与 id 漂移、关闭 PR 排除、step 容差（含 PR3097 真实源 fixture 由“隔离”改为可测量 5350 秒）、90 天回溯与候选条件、多候选身份与展示。
- 全量 Python 1130 项、Node 373 项、Chromium 78 项通过；改动行覆盖率 100%（`scripts/verify_changed_coverage.py`）。
- 部署后复核：`window_end == discovery.fetch_window_end`、manifest 指纹一致、E2E 样本 ~160+、未关联/多候选数量与候选链接可核对、NPU 点数同量级。
