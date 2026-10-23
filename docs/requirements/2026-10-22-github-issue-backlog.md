# GitHub需求Issue发布清单与待提交正文（2026-10-22）

发布尚未完成。GitHub在批量建项期间返回 `403 — Sorry. Your account was suspended`，已停止继续写入。需要恢复账号，或使用经授权且有该仓Issue写权限的账号后继续；本文件不代表全部需求已发布。

已收到创建成功响应：[总索引 #17](https://github.com/tianli-Backkom/union_monitor/issues/17)及18个需求Issue（#18–#35），共19个。剩余16个待创建；#27/#34的两处历史AC口径澄清和#17的最终索引待更新。创建时已核对返回正文/标题，账号阻断后未完成全量独立读回。

四份规格的77个需求编号归并为34个可跟踪Issue，保留159个AC编号。每项正文包含需求、实施范围、可勾选验收、测试/固定输入和证据要求。全部业务AC未勾选；这里只核对需求建项，不声称业务整改完成。

可恢复发布的完整数据见 [Issue清单JSON](2026-10-22-github-issue-manifest.json)。恢复后按唯一key标记先查重，补建16项、更新两处正文与总索引，再全量读回核对标题/正文/77编号/159AC；不要盲目重建已有项。

当前展示以EC为准，提交时间/门禁以PSG为准。已退役工作台、固定任务栏、质量/采集/说明页与高级面板不恢复。额外缩放、独立新PR统计及第三社区明确后置。历史后台组用于回归和补证，不作为本期展示重构前置。

## 全部需求与发布状态

| 主编号 | 需求 | 原编号 | 发布状态 |
|---|---|---|---|
| EC-001 | 精简主导航为 UBSCore / Triton-Ascend 两个入口 | EC-001、UAR-017、UDR-015 | [已建 #18](https://github.com/tianli-Backkom/union_monitor/issues/18)，待最终读回 |
| EC-002 | 将项目概览明确为 UBSCore 九仓总览 | EC-002 | [已建 #19](https://github.com/tianli-Backkom/union_monitor/issues/19)，待最终读回 |
| EC-003 | 合并趋势与记录为同一工程效能页 | EC-003 | [已建 #20](https://github.com/tianli-Backkom/union_monitor/issues/20)，待最终读回 |
| EC-004 | 仅展示有来源的核心工程能力指标 | EC-004 | [已建 #21](https://github.com/tianli-Backkom/union_monitor/issues/21)，待最终读回 |
| EC-005 | 独立计算 E2E / NPU 样本与池化分位数 | EC-005、UDR-001、UDR-007 | [已建 #22](https://github.com/tianli-Backkom/union_monitor/issues/22)，待最终读回 |
| EC-006 | UBS 一 PR 一行，最长执行作代表，详情保留全部执行 | EC-006、UAR-001、UAR-002、UAR-006、UDR-009、UDR-017 | [已建 #23](https://github.com/tianli-Backkom/union_monitor/issues/23)，待最终读回 |
| EC-007 | 统一分析范围与列表定位，消除隐藏筛选 | EC-007、UAR-005、UAR-008、UDR-016 | [已建 #24](https://github.com/tianli-Backkom/union_monitor/issues/24)，待最终读回 |
| EC-008 | 在页面就地表达截止、缺失与未知状态 | EC-008、UAR-015、UAR-020、UDR-006、UDR-011 | [已建 #25](https://github.com/tianli-Backkom/union_monitor/issues/25)，待最终读回 |
| EC-009 | 保证旧地址、分享、详情与浏览器历史一致 | EC-009、UAR-007、UAR-009、UDR-010、UDR-020 | [已建 #26](https://github.com/tianli-Backkom/union_monitor/issues/26)，待最终读回 |
| EC-010 | 修复散点图贴边并保障窄屏与键盘使用 | EC-010、UAR-010、UAR-019、UDR-014 | [已建 #27](https://github.com/tianli-Backkom/union_monitor/issues/27)，待正文澄清 |
| EC-011 | 导出完整定位集合及可复算的元数据 | EC-011、UAR-018、UDR-019 | [已建 #28](https://github.com/tianli-Backkom/union_monitor/issues/28)，待最终读回 |
| EC-012 | 清理退役页面依赖与交互资源 | EC-012、UDR-012 | [已建 #29](https://github.com/tianli-Backkom/union_monitor/issues/29)，待最终读回 |
| PSG-001 | 以最近一次代码提交／推送派生提交时间，排除重跑 | PSG-001 | [已建 #30](https://github.com/tianli-Backkom/union_monitor/issues/30)，待最终读回 |
| PSG-002 | 将创建时间排序替换为真实提交时间排序并保证全量分页 | PSG-002、UAR-003、UDR-018 | [已建 #31](https://github.com/tianli-Backkom/union_monitor/issues/31)，待最终读回 |
| PSG-003 | 提交时间排序贯通 URL、历史与 CSV 兼容 | PSG-003 | [已建 #32](https://github.com/tianli-Backkom/union_monitor/issues/32)，待最终读回 |
| PSG-004 | 将 12 项基本用户旅程纳入 PR 必需执行门禁 | PSG-004 | [已建 #33](https://github.com/tianli-Backkom/union_monitor/issues/33)，待最终读回 |
| PSG-005 | 保护全旅程运行错误、双社区读取失败与恢复 | PSG-005、UAR-016、UDR-013 | [已建 #34](https://github.com/tianli-Backkom/union_monitor/issues/34)，待正文澄清 |
| PSG-006 | 校验四门禁真实执行并防止最终检查假绿 | PSG-006、UDR-036 | [已建 #35](https://github.com/tianli-Backkom/union_monitor/issues/35)，待最终读回 |
| PSG-007 | 以 12 项故障注入证明门禁能拦截基本功能破坏 | PSG-007、UDR-038 | [待建：完整正文](#draft-psg-007) |
| UAR-004 | 正确读取 trigger 排队字段并贯通展示、排序和导出 | UAR-004 | [待建：完整正文](#draft-uar-004) |
| UAR-014 | 建立来源枚举到公开记录的逐身份覆盖与排除账本 | UAR-014、UDR-003、UDR-004、UDR-005 | [待建：完整正文](#draft-uar-014) |
| UAR-011 | 后续增强：极端长耗时下聚焦主要散点并恢复全范围 | UAR-011 | [待建：完整正文](#draft-uar-011) |
| UAR-012 | 后续增强：独立核实今天新建 PR，区分涉及 PR 与重跑批次 | UAR-012 | [待建：完整正文](#draft-uar-012) |
| HIST-IDENTITY | 历史回归：可信 PR 关联、强推历史与未知身份恢复 | UDR-002 | [待建：完整正文](#draft-hist-identity) |
| HIST-CONTRACT | 历史回归：适配器、完整身份、工件与格式兼容契约 | UDR-008、UDR-021、UDR-022、UDR-035 | [待建：完整正文](#draft-hist-contract) |
| HIST-LEGACY | 历史回归：legacy UBS 九仓失败必须阻断伪成功发布 | UDR-023 | [待建：完整正文](#draft-hist-legacy) |
| HIST-SCHEDULE | 历史架构：统一生产上下文、整轮排队与防旧版本覆盖 | UDR-024、UDR-025 | [待建：完整正文](#draft-hist-schedule) |
| HIST-BUNDLE | 历史回归：公共装配校验完整发布束及资源引用闭包 | UDR-026 | [待建：完整正文](#draft-hist-bundle) |
| HIST-FALLBACK | 历史回归：可信旧束回退、全失败保留与 verified 原子提升 | UDR-027、UDR-028 | [待建：完整正文](#draft-hist-fallback) |
| HIST-DEPLOY | 历史回归：部署后比较公开实际字节并执行可验证恢复 | UDR-029、UDR-030 | [待建：完整正文](#draft-hist-deploy) |
| HIST-SECURITY | 历史回归：隔离来源缓存、证据、公开资源和发布权限 | UDR-031 | [待建：完整正文](#draft-hist-security) |
| HIST-FRESHNESS | 区分覆盖截止、采集和读取时间，按实际计划说明迟更 | UDR-032、UDR-033、UAR-013 | [待建：完整正文](#draft-hist-freshness) |
| HIST-THIRD | 后续架构：以真实全链路验证第三社区接入能力 | UDR-034 | [待建：完整正文](#draft-hist-third) |
| HIST-DOCS | 同步 README、离线引导与实际页面、数据口径和迁移状态 | UDR-037 | [待建：完整正文](#draft-hist-docs) |

## 历史AC与当前验收映射

以下17个编号保留原AC编号，但已按最新EC范围调整验收；正文明确标记为映射，非历史原文：UDR-015、UAR-017、UAR-008、UDR-016、UAR-015、UDR-011、UDR-006、UDR-009、UDR-010、UDR-018、UDR-017、UDR-019、UDR-020、UDR-032、UAR-013、UAR-016、UAR-019。#27中UAR-019改按实际P50/P90读取，不强制增加均值；#34中UAR-016只覆盖现存页面，工作台路径退役。两处远端更新被账号限制阻止，目标正文见下方。

历史缺证据仍需补证：UDR-001的371/93冻结输入、UDR-005的887/885逐身份差异、UDR-024/035的真实old/new CLI同输入迁移对照。新窗口样本或历史“已实现”标签均不能代替。

## 待创建的16个Issue正文

<a id="draft-psg-007"></a>

### [PSG-007][P1] 以 12 项故障注入证明门禁能拦截基本功能破坏

<!-- union-monitor-requirements-20261022 key=PSG-007 ids=PSG-007,UDR-038 -->

关联总索引：[需求总索引 #17](https://github.com/tianli-Backkom/union_monitor/issues/17)

**优先级：** P1　**范围/状态：** 本期／待实施或待验收

**覆盖原编号：** PSG-007、UDR-038

## 产品目标与范围

只保留能反映UBSCore / Triton-Ascend工程反馈速度、门禁稳定性和主要瓶颈的信息。导航仅两个社区、三种规范页；不恢复工作台、固定任务栏、独立数据质量/采集/指标说明页或高级分析面板。必要的截止、样本、排除与来源就地解释。

状态为待逐项核验；关联PR或历史台账不能替代当前代码业务验收。已有实现直接补验，有差距再改代码，避免重复开发；缺证据项保持未勾选。

## 详细需求、实施约束与固定输入

## 4. 必需页面旅程与门禁执行约束

保留现有四job和最终必需检查名。frontend-tests执行完整既有浏览器套件，并把下列BASIC用例纳入必需集合；不因为40这个历史数量固定总测试数。清单明确列ID/用例名，JUnit检查这些用例均存在、实际执行、无失败/跳过；不能根据当前发现到的测试自动缩小必需清单。

| ID | 固定输入/操作 | 必须断言的用户结果 | 复用或新增位置 |
|---|---|---|---|
| BASIC-001 | UBS总览、UBS单仓、Triton规范入口冷启动 | 正确标题/社区/真实非空数据身份；控件可操作；无非预期脚本/资源错误 | dashboard、unified-navigation |
| BASIC-002 | 总览点仓→Triton→UBS→前进/后退，含旧链接 | 社区、仓、活动导航、规范地址对应；旧详情释放，无空白/占位旧任务 | unified-navigation、url-context |
| BASIC-003 | 第6节相反时钟样本，原生select选submitted；切换各PR/批次排序 | 文案/value/实际全页行ID/显示时间正确，非只断言控件选中 | 新ubs-submission-sort.spec.cjs＋unified-records |
| BASIC-004 | ≥31 PR，分别15/30/50遍历每一页 | 精确全集顺序、唯一ID、首末页、按钮和重置正确，关键路径不条件skip | unified-records |
| BASIC-005 | 独立编号/标题/作者/SHA/no-match，清除与当前PR状态筛选 | 精确命中ID/count；no-match数据行0＋空态；搜索不改分析KPI；状态筛选按其明确语义计算 | advanced-sample-filter |
| BASIC-006 | 多执行PR、非代表批次、无代表、异仓同号 | PR唯一、最长代表不变；详情打开实际选中身份与任务；全部已采集执行可查 | unified-detail |
| BASIC-007 | 打开详情、Escape/关闭、刷新、Back/Forward | dialog、pr/batch参数及实际内容同步；回焦点，筛选/排序/页码不丢 | unified-detail、url-context |
| BASIC-008 | Triton分支/共享选窗、图点定位、时间未知；UBS任务排队/执行切换 | 每图按自身资格从同一S派生；有效n/读数可核对；选择实际改变范围/读数；未知时间不混统计 | dashboard＋指标受控fixture |
| BASIC-009 | UBS/Triton分别首读503/坏JSON/超时及成功后重读失败，再恢复 | 首读不报零成功；旧身份/截止保留，错误明确、reload恢复；另一社区可用 | 新basic-load-recovery.spec.cjs |
| BASIC-010 | 搜索＋跨页＋submitted排序，实际下载CSV及选中执行任务 | 下载ID、顺序、全量L、毫秒/秒单位、提交时间来源正确；不只看行数 | unified-export、unified-detail |
| BASIC-011 | 320/390/768/1024/1440及长时间轴 | 关键身份/结果/时间/详情按钮可达，无页面横溢；图标签边界不裁切/重叠 | dashboard布局用例增强 |
| BASIC-012 | 纯键盘进入社区、检索/排序、打开记录/图点详情、退出 | 按Enter/Space实际触发，Escape后焦点/URL恢复，无焦点陷阱 | 新basic-keyboard.spec.cjs或复用detail |

PR状态生命周期分析筛选与“失败/执行中”等记录定位不是同一条件：门禁必须逐一说明S/L预期。本期提交时间排序不得借机改变现有分析范围；若与既有EC展示方案待落地部分冲突，单列差异，不用同一测试对两个含义互相背书。

测试输入必须固定、可离线构造、与预期排序独立。禁止用生产sort函数生成预期再与自身比较；不得依赖当天线上PR数或源站可用性。新增公共浏览器fixture在整个旅程收集pageerror、console.error、关键同源JS/CSS/JSON加载失败；故障用例只对明确URL/状态/消息做局部预期放行，不全局吞错。

CI设置forbidOnly=true并保留0 retry；关键用例禁止skip/fixme。YAML结构测试要验证四job、精确needs/always、真实Node/浏览器执行步骤、没有continue-on-error或条件绕过，并追踪package.json中test:browser仍执行完整套件而非仅list/单文件；不能只靠命令文字出现在注释里。basic清单核验、JUnit、trace/截图保留在现有frontend-tests内，失败导致该job失败。JUnit须由本轮清理旧产物后新生并绑定当前代码/run，不得沿用旧报告冒充本轮实际执行。


## 7. 故障注入与实施顺序

| 故障ID | 仅在隔离测试副本施加的破坏 | 必须转红的层/用例 |
|---|---|---|
| MUT-001 | submitted比较器仍读created_ms，文案已改 | PSG-001模型/独立oracle＋BASIC-003实际行序 |
| MUT-002 | 将retest或Jenkins时间纳入提交候选 | PSG-001事件边界、BASIC-003 |
| MUT-003 | 仅排序当前页或拼接丢一行 | BASIC-004全页精确ID序列 |
| MUT-004 | 移除search/change/详情点击事件绑定 | BASIC-003/005/006真实动作与内容断言 |
| MUT-005 | no-match仍显示原数据，或搜索改KPI | BASIC-005行ID/数量/分析范围断言 |
| MUT-006 | 选中批次改开代表，或Escape残留URL | BASIC-006/007完整身份与历史路径 |
| MUT-007 | 导出仅当前页，或创建值装成提交时间 | BASIC-010下载解析 |
| MUT-008 | 关键脚本404、抛异常或重读吞错改时间 | BASIC-001/009全旅程错误与回退身份 |
| MUT-009 | .only、关键skip、缺必需ID、移除browser步骤 | forbidOnly、JUnit清单、YAML结构契约 |
| MUT-010 | 四job任一失败/取消/缺失仍汇总绿 | ci_gate CLI负向矩阵＋受控CI检查 |
| MUT-011 | 窄屏隐藏关键按钮/轴标签被裁切 | BASIC-011/012可见边界与键盘任务 |
| MUT-012 | 分支/选窗或排队-执行切换事件无效，图表仍显示旧读数 | BASIC-008实际身份集合、n和数值变化 |

实施按以下提交拆分：

1. `metrics.py`/`collect.py`新增事件时间与状态派生，更新旧schema兼容/采集契约；先写create/push/retest/partial反例。
2. `web/core.js`/`app.js`/`index.html`/URL及CSV接线，升级独立`verify_ubs_sorting.py`及相关Node/Python预期；不变更E2E资格与创建队列。
3. 构造≥31条基础fixture，增强现有8个browser文件，按需要新增提交排序/双社区恢复/键盘用例；逐项补BASIC身份级断言。
4. 公共浏览器错误fixture、CI forbidOnly、显式BASIC清单/JUnit核验、YAML结构变异测试纳入现有frontend-tests和python-tests；不更换必需job名称。
5. 在隔离副本执行MUT-001～012，恢复后跑Python/Node/Chromium/collector-contracts/workflow-lint；证据绑定实际代码和输入，再走PR等待最终门禁全绿。

所有改动更新相应测试并创建Git commit；main保留required_status_checks与required_pull_request_reviews，不直接推main、不通过删除门禁/审核绕过。合并后删除本地和远端临时分支。此文档提交不代表上述页面行为已经实现，也不代表已读回远端保护。


## 可逐项核对的需求和验收清单

### PSG-007：用故障反证门禁有效并闭环交付（P1）
**需求：** 基本用例不仅绿，还要证明能拦对应破坏；证据绑定提交与输入。

- [ ] PSG-007-AC01：第7节每项受控故障至少被一个正确命名的用例拦住，失败原因是行为断言而非测试环境没启动；恢复后全套绿，不在生产或main故意制造故障。
- [ ] PSG-007-AC02：交付记录代码SHA、fixture指纹、用例清单、实际pass/fail/skip、JUnit/trace/故障差异与恢复结果。文档结构、模型、浏览器、CI和远端保护分别记录，缺证据标未验证。

**验证：** 隔离临时checkout/工作树逐一注入并恢复，不用降低断言、增加无依据重试或删除保护转绿。

### UDR-038：逐需求/验收证据闭环及规格完整性

**来源：** R11；报告“验证与证据入口”及业务验收边界；历史 REQ-050/051。
**优先级：** P1。
**需求描述：** 每项需求具有唯一编号、来源、状态、描述、可自动化用例和可判断 AC；问题/目标差距无漏项。业务验收以每条 AC 的实际证据为准，文档结构校验、提交映射、模型单测与真实采集/页面/发布验收分别记录。交付 commit 仅纳入任务文件，测试/证据绑定实际代码与输入版本。

**自动化测试用例：**

| 用例 | 输入与操作 | 预期断言 | 关联验收 | 自动化覆盖 |
|---|---|---|---|---|
| UDR-038-TC01 | 输入：本规格及审查来源；操作：扫描编号/来源/描述、用例输入动作断言、TC→AC 映射与本地链接，参数化删除/重复/破坏字段。 | 38 个需求完整唯一；12 个 R 组和未完成章节可追踪；每 AC 有用例，引用真实；损坏文档拒绝，待新增测试不误报已存在。 | UDR-038-AC01 | 现有：本轮新增文档检查 [test_audit_requirements_doc.py](https://github.com/tianli-Backkom/union_monitor/blob/3889c8e4217db60bc3b5e5cde276f8cbd73c2d79/tests/test_audit_requirements_doc.py)及变异测试；只验规格结构，不验业务实现。 |
| UDR-038-TC02 | 输入：缺执行记录/资源/实际值、代码或输入指纹不一致、非零退出、helper冒充页面/发布验收、纯提交标题；操作：生成逐AC台账/总体状态并核对Git文件。 | 缺证据为未验证、执行差异为失败，不能自报passed就通过；每个通过可复核输入/代码/命令/实际值；未提交日志不入commit，正文/台账一致。 | UDR-038-AC02 | 待补充：[验收工具](https://github.com/tianli-Backkom/union_monitor/blob/3889c8e4217db60bc3b5e5cde276f8cbd73c2d79/tests/test_acceptance.py)、[需求文档验证](https://github.com/tianli-Backkom/union_monitor/blob/3889c8e4217db60bc3b5e5cde276f8cbd73c2d79/tests/test_requirements_doc.py)、[审查产物](https://github.com/tianli-Backkom/union_monitor/blob/3889c8e4217db60bc3b5e5cde276f8cbd73c2d79/tests/test_audit_report.py)到 UDR 逐 AC 台账。 |

**验收条件：**

- [ ] UDR-038-AC01：规格结构、来源追踪、编号和用例/AC/链接校验全部通过；明确待新增/待补覆盖，不据此宣布业务完成。
- [ ] UDR-038-AC02：所有业务通过均有实际可复核证据；未实现/未验证不隐藏，commit 与测试/输入/证据一致且不含既有未提交改动。

## 交付与证据

逐条记录AC→实际代码SHA→固定输入/来源指纹→操作或命令→预期/实际身份和数值→截图、实际下载或测试报告。文档/静态、模型、真实浏览器、来源对账和公开部署核验分别记录；缺证据标未验证。历史数字仅用于对应冻结输入，不作为每日阈值。

如需改代码，更新相关测试并创建对应Git commit；通过PR合入main。等待python-tests / frontend-tests / collector-contracts / workflow-lint及最终 **Dashboard quality gate** 全绿，保留required_status_checks与required_pull_request_reviews，不直推main或绕过保护；合并后删除临时分支。

## 来源与已有实现

- 原始方案：`docs/requirements/2026-10-22-pr-submission-sort-and-quality-gate.md`，本地规格提交`3096c69`；尚未合入main，相关完整契约已内嵌正文，不依赖未发布文件。
- [2026-10-12-unified-dashboard-audit-requirements.md](https://github.com/tianli-Backkom/union_monitor/blob/3889c8e4217db60bc3b5e5cde276f8cbd73c2d79/docs/requirements/2026-10-12-unified-dashboard-audit-requirements.md)


---

<a id="draft-uar-004"></a>

### [UAR-004][P1] 正确读取 trigger 排队字段并贯通展示、排序和导出

<!-- union-monitor-requirements-20261022 key=UAR-004 ids=UAR-004 -->

关联总索引：[需求总索引 #17](https://github.com/tianli-Backkom/union_monitor/issues/17)

**优先级：** P1　**范围/状态：** 本期／待实施或待验收

**覆盖原编号：** UAR-004

## 产品目标与范围

只保留能反映UBSCore / Triton-Ascend工程反馈速度、门禁稳定性和主要瓶颈的信息。导航仅两个社区、三种规范页；不恢复工作台、固定任务栏、独立数据质量/采集/指标说明页或高级分析面板。必要的截止、样本、排除与来源就地解释。

状态为待逐项核验；关联PR或历史台账不能替代当前代码业务验收。已有实现直接补验，有差距再改代码，避免重复开发；缺证据项保持未勾选。

## 详细需求、实施约束与固定输入

冻结107批次顶层queue_ms缺失，实际证据在trigger.queue_ms。不得用人为补顶层字段的fixture掩盖生产形状。触发排队与任务最大排队分别解释；waiting+blocked+buildable按已有UBS定义处理。

## 可逐项核对的需求和验收清单

### UAR-004：排队列读取真实证据

**问题与影响：** E02。107 批次的顶层 `queue_ms` 均缺失，`trigger.queue_ms` 有值；`web/records.js` 读顶层字段，导致用户看到全部“—”，排队排序失去意义。

**需求要求：** 定义公共批次排队字段的来源与单位，规范化时读取实际 trigger 排队证据；若含其他分项，按当前 UBS waiting+blocked+buildable 定义，不把任务最大排队与 trigger 排队混为同一指标。确实缺证据才显示未知。

**验收标准：**
- [ ] UAR-004-AC01：E02 样本中有有效 trigger.queue_ms 的行显示对应分钟值，详情/排序/导出可对照源毫秒；不是107行全部未知。
- [ ] UAR-004-AC02：合法0显示0、缺字段/异常值显示未知与原因；不同排队定义在字段与说明中可区分，不凭空合计。

**测试设计：** 用真实形状 `{trigger:{queue_ms:…}}` 和缺值样本覆盖规范化、排序及页面，避免只测人为带顶层 queue_ms 的 fixture。

## 交付与证据

逐条记录AC→实际代码SHA→固定输入/来源指纹→操作或命令→预期/实际身份和数值→截图、实际下载或测试报告。文档/静态、模型、真实浏览器、来源对账和公开部署核验分别记录；缺证据标未验证。历史数字仅用于对应冻结输入，不作为每日阈值。

如需改代码，更新相关测试并创建对应Git commit；通过PR合入main。等待python-tests / frontend-tests / collector-contracts / workflow-lint及最终 **Dashboard quality gate** 全绿，保留required_status_checks与required_pull_request_reviews，不直推main或绕过保护；合并后删除临时分支。

## 来源与已有实现

- [2026-10-21-dashboard-user-audit.md](https://github.com/tianli-Backkom/union_monitor/blob/3889c8e4217db60bc3b5e5cde276f8cbd73c2d79/docs/requirements/2026-10-21-dashboard-user-audit.md)


---

<a id="draft-uar-014"></a>

### [UAR-014][P1] 建立来源枚举到公开记录的逐身份覆盖与排除账本

<!-- union-monitor-requirements-20261022 key=UAR-014 ids=UAR-014,UDR-003,UDR-004,UDR-005 -->

关联总索引：[需求总索引 #17](https://github.com/tianli-Backkom/union_monitor/issues/17)

**优先级：** P1　**范围/状态：** 本期／待实施或待验收

**覆盖原编号：** UAR-014、UDR-003、UDR-004、UDR-005

## 产品目标与范围

只保留能反映UBSCore / Triton-Ascend工程反馈速度、门禁稳定性和主要瓶颈的信息。导航仅两个社区、三种规范页；不恢复工作台、固定任务栏、独立数据质量/采集/指标说明页或高级分析面板。必要的截止、样本、排除与来源就地解释。

状态为待逐项核验；关联PR或历史台账不能替代当前代码业务验收。已有实现直接补验，有差距再改代码，避免重复开发；缺证据项保持未勾选。

## 详细需求、实施约束与固定输入

2026-10-21同截止Actions定向集合：pull_request147个、pull_request_target139个，各2页，286个唯一run ID均在公开workflow集合。只证明此同截点集合，不能推广为72小时全部attempt/job完整。manifest1389与公开1379的差10须逐身份解释；历史887/885原始enriched输入与差异也须独立补证，不能硬编码差值或用新样本替代。14天回看不能支持对17天前run今天重跑的全量承诺。账本提供后台证据与页内摘要/来源入口，不恢复独立数据质量页或采集面板。

## 可逐项核对的需求和验收清单

### UAR-014：来源覆盖与排除可逐项对账

**问题与影响：** E04。manifest的runs=1389，公开批次workflow-attempt唯一身份1379；差10可能来自合法分组窗口排除，不能直接认定漏采。现有quality检查有expected/batched约束，但未向用户提供完整逐身份解释；分页/强推/重跑源数据仍需对账。

**需求要求：** 用仓库、来源事件、run_id、attempt等完整身份建立源枚举→纳入→合法排除→未关联→失败账本，记录分页是否完成、窗口、分支、认证/限流/超时和取证时间。每个差异可追溯原因；计数校验不能代替身份集合校验。用户可查看覆盖摘要、未覆盖原因与证据入口。当前生产发现重跑只向窗口起点之前回看14天，必须明示或消除老run今天重跑的覆盖限制；本轮未证实存在这样的实际漏采。

**验收标准：**
- [ ] UAR-014-AC01：相同截止/分支的源全集与发布全集做集合差；差异每项有来源和排除规则，未解释项数为0才标已对账。1389与1379若差异合法须列出10项归属，不能直接把两数改成一样。
- [ ] UAR-014-AC02：注入分页截断、配额/网络失败、强推历史、attempt重跑、同SHA异PR与窗外批次；错误不得伪装完整/零，合法排除不冒充漏采；无独立源证据标未验证。
- [ ] UAR-014-AC03：构造run创建早于17天、今天发生新attempt的输入，今天重跑须能被发现并只计一次；若来源无法支持则公开标明不可验证范围，不能标当天全量完整。

**测试设计：** 复用source coverage/identity测试并增加生产输出账本的集成验收；实际同截止对账附源响应页码、身份与指纹，不以collector自己生成的计数互证完整。

### UDR-003：以原始集合检查批次和任务完整性

**来源：** R02；技术 T-008。
**优先级：** P1。
**需求描述：** 应有 run/attempt/job 集合从原始来源证据独立计算，再与派生输出比对；不得从输出反推应有集合。窗口豁免依据来源及当前 attempt 起点，整批缺失不构成窗外理由。

**自动化测试用例：**

| 用例 | 输入与操作 | 预期断言 | 关联验收 | 自动化覆盖 |
|---|---|---|---|---|
| UDR-003-TC01 | 输入：窗内 run/attempt 含 NPU job；操作：生成正确数据后删除整批并重算空 summary，再执行质量门禁。 | 门禁失败，指出缺失 run/attempt 与 NPU job；不能因输出为空而通过。 | UDR-003-AC01 | 现有：[整批删除攻击](https://github.com/tianli-Backkom/union_monitor/blob/3889c8e4217db60bc3b5e5cde276f8cbd73c2d79/tests/test_triton_audit_gates.py)。 |
| UDR-003-TC02 | 输入：非 NPU workflow、一个缺失 job、初建窗外但 attempt 2 窗内，以及合法窗外 attempt；操作：逐项删除并验证。 | 任一应有实体删除均报告具体身份；attempt 2 保留；只有有证据的窗外实体可豁免并记录原因。 | UDR-003-AC02 | 待补充：[attempt 窗口](https://github.com/tianli-Backkom/union_monitor/blob/3889c8e4217db60bc3b5e5cde276f8cbd73c2d79/tests/test_triton_audit_gates.py)、[workflow/job 质量](https://github.com/tianli-Backkom/union_monitor/blob/3889c8e4217db60bc3b5e5cde276f8cbd73c2d79/tests/test_triton_quality.py)。 |

**验收条件：**

- [ ] UDR-003-AC01：原整批删除攻击被实际发布前门禁拒绝，缺失原因可定位来源身份。
- [ ] UDR-003-AC02：窗内应有身份存在且唯一；每项排除可追溯；完整性不只检查 NPU 数量。

### UDR-004：全来源枚举与独立核查边界

**来源：** R02；报告“数据准确性与完整性”的全来源补证。
**优先级：** P1。
**需求描述：** 在可访问来源和声明窗口内验证分页、历史 attempt、PR/事件、workflow/job 的枚举与核查覆盖。保留采集来源集合和独立原始证据。派生自洽、公开指纹、定向抽样、全来源核查分别报告；无适用对象、缺证据、差异和请求失败不得混为成功。

**自动化测试用例：**

| 用例 | 输入与操作 | 预期断言 | 关联验收 | 自动化覆盖 |
|---|---|---|---|---|
| UDR-004-TC01 | 输入：分页截断、重复页、total_count 漂移、缺 id、jobs_complete=false、旧 run 窗内重跑及合法零结果；操作：通过默认 collector 枚举并与独立清单比对。 | 异常采集/验证非成功；所有可证明窗内 attempt 和 job 被保留且去重；合法零数据通过，不承诺未可得的历史全集。 | UDR-004-AC01 | 待补充：[API/attempt](https://github.com/tianli-Backkom/union_monitor/blob/3889c8e4217db60bc3b5e5cde276f8cbd73c2d79/tests/test_triton_dashboard.py)、[NPU API](https://github.com/tianli-Backkom/union_monitor/blob/3889c8e4217db60bc3b5e5cde276f8cbd73c2d79/tests/test_triton_npu_api.py)；待新增独立来源服务集成测试。 |
| UDR-004-TC02 | 输入：5 个适用身份，其中 2 原始核实一致、1 差异、2 缺证据；另给仅 3 run/11 job 抽样及纯派生复算；操作：生成核查报告。 | 适用数=一致+差异+缺证据，身份集合闭合；派生不计原始核实；抽样不升级成全量通过，PR #2513 历史关联仍未核实。 | UDR-004-AC02 | 待补充：[来源覆盖语义](https://github.com/tianli-Backkom/union_monitor/blob/3889c8e4217db60bc3b5e5cde276f8cbd73c2d79/tests/test_source_coverage.py)；现有主要为 UBS 合成来源树，需补 Triton 全来源报告。 |

**验收条件：**

- [ ] UDR-004-AC01：声明可核查范围内的来源枚举与身份集合一致，分页/历史不可得范围明确列出，来源异常不可伪装零数据。
- [ ] UDR-004-AC02：每个“全量已核实”类别有独立原始证据且差异/缺证据均为零；抽样、缓存、健康检查或离线测试不能替代该证据。

### UDR-005：采集到公开输出的计数账本

**来源：** 报告“数据准确性与完整性”：manifest runs=887、公开唯一 workflow-attempt=885 未解释。
**优先级：** P2。
**需求描述：** 区分原始返回行数、唯一 run/attempt、公开 workflow/attempt、窗外和其他排除；提供逐行/逐身份原因。workflow/attempt 数不能与聚合后的 batch 行数直接比较；无法解释的差异保持未核实，不硬编码减 2。

**自动化测试用例：**

| 用例 | 输入与操作 | 预期断言 | 关联验收 | 自动化覆盖 |
|---|---|---|---|---|
| UDR-005-TC01 | 输入：4 原始行含 1 重复，3 唯一身份中 2 公开、1 窗外；操作：生成并独立核对账本，再删除/伪造一个排除原因。 | 4=3+1；3=2+1+0；公开/窗外/其他互斥完备；篡改后失败且命名身份。 | UDR-005-AC01 | 待新增 `tests/test_triton_coverage_ledger.py`。 |
| UDR-005-TC02 | 输入：2026-10-11 完整 enriched evidence 或明确缺失的该证据；操作：重放 887/885 的计数阶段。 | 差异每条原始行/来源身份与原因可验证才关闭补证；缺证据保持未核实，不猜成两条遗漏或两条合法排除。 | UDR-005-AC02 | 待新增该日冻结证据回放；参考[独立复算记录](https://github.com/tianli-Backkom/union_monitor/blob/3889c8e4217db60bc3b5e5cde276f8cbd73c2d79/audit/2026-10-11/evidence/independent-recompute.json)。 |

**验收条件：**

- [ ] UDR-005-AC01：每轮计数可按定义独立复算，去重及排除集合形成完整账本，未解释差异不能标已核实。
- [ ] UDR-005-AC02：历史 887/885 单独完成证据闭环；证据不可得时如实保留未核实，不阻止文档表达真实未完成状态。

## 交付与证据

逐条记录AC→实际代码SHA→固定输入/来源指纹→操作或命令→预期/实际身份和数值→截图、实际下载或测试报告。文档/静态、模型、真实浏览器、来源对账和公开部署核验分别记录；缺证据标未验证。历史数字仅用于对应冻结输入，不作为每日阈值。

如需改代码，更新相关测试并创建对应Git commit；通过PR合入main。等待python-tests / frontend-tests / collector-contracts / workflow-lint及最终 **Dashboard quality gate** 全绿，保留required_status_checks与required_pull_request_reviews，不直推main或绕过保护；合并后删除临时分支。

## 来源与已有实现

- [2026-10-21-dashboard-user-audit.md](https://github.com/tianli-Backkom/union_monitor/blob/3889c8e4217db60bc3b5e5cde276f8cbd73c2d79/docs/requirements/2026-10-21-dashboard-user-audit.md)
- [2026-10-12-unified-dashboard-audit-requirements.md](https://github.com/tianli-Backkom/union_monitor/blob/3889c8e4217db60bc3b5e5cde276f8cbd73c2d79/docs/requirements/2026-10-12-unified-dashboard-audit-requirements.md)


---

<a id="draft-uar-011"></a>

### [UAR-011][P2] 后续增强：极端长耗时下聚焦主要散点并恢复全范围

<!-- union-monitor-requirements-20261022 key=UAR-011 ids=UAR-011 -->

关联总索引：[需求总索引 #17](https://github.com/tianli-Backkom/union_monitor/issues/17)

**优先级：** P2　**范围/状态：** 后续项／不作为本期精简展示前置

**覆盖原编号：** UAR-011

## 产品目标与范围

只保留能反映UBSCore / Triton-Ascend工程反馈速度、门禁稳定性和主要瓶颈的信息。导航仅两个社区、三种规范页；不恢复工作台、固定任务栏、独立数据质量/采集/指标说明页或高级分析面板。必要的截止、样本、排除与来源就地解释。

状态为待逐项核验；关联PR或历史台账不能替代当前代码业务验收。已有实现直接补验，有差距再改代码，避免重复开发；缺证据项保持未勾选。

## 详细需求、实施约束与固定输入

额外纵轴缩放工具按EC方案后置，本期EC-010仍须完成基础标签可读性。缩放不得删除真实极端值、偷改KPI/分母或来源；工具必要性依据本期布局整改后的实际使用效果。

## 可逐项核对的需求和验收清单

### UAR-011：极端长耗时下的分析可用性

**问题与影响：** E03中纵轴最高刻度1876.63分钟，而中位19.88、P90为100.76分钟；在线性全范围下主要样本可读性存在风险。本项是可用性增强，未认定极端值是脏数据。

**需求要求：** 保留真实异常点及全范围，提供明确的局部纵轴查看或聚焦主要样本能力，并提示窗口外/被截显示数量；恢复全范围入口清晰。查看缩放不应悄悄改变分析分母或删除异常记录。

**验收标准：**
- [ ] UAR-011-AC01：含20分钟主要样本和超过1000分钟异常的fixture，可查看主要样本差异并返回全范围定位异常，来源与时长保持不变。
- [ ] UAR-011-AC02：只调整视图时KPI和分位数不变；若用户明确筛选样本，必须显示新范围、分母和排除数量，导出带相同口径。

**测试设计：** 固定分布比较视图缩放前后的身份集/统计，补鼠标与键盘恢复操作及视觉验收。

## 交付与证据

逐条记录AC→实际代码SHA→固定输入/来源指纹→操作或命令→预期/实际身份和数值→截图、实际下载或测试报告。文档/静态、模型、真实浏览器、来源对账和公开部署核验分别记录；缺证据标未验证。历史数字仅用于对应冻结输入，不作为每日阈值。

如需改代码，更新相关测试并创建对应Git commit；通过PR合入main。等待python-tests / frontend-tests / collector-contracts / workflow-lint及最终 **Dashboard quality gate** 全绿，保留required_status_checks与required_pull_request_reviews，不直推main或绕过保护；合并后删除临时分支。

## 来源与已有实现

- [2026-10-21-dashboard-user-audit.md](https://github.com/tianli-Backkom/union_monitor/blob/3889c8e4217db60bc3b5e5cde276f8cbd73c2d79/docs/requirements/2026-10-21-dashboard-user-audit.md)


---

<a id="draft-uar-012"></a>

### [UAR-012][P1] 后续增强：独立核实今天新建 PR，区分涉及 PR 与重跑批次

<!-- union-monitor-requirements-20261022 key=UAR-012 ids=UAR-012 -->

关联总索引：[需求总索引 #17](https://github.com/tianli-Backkom/union_monitor/issues/17)

**优先级：** P1　**范围/状态：** 后续项／不作为本期精简展示前置

**覆盖原编号：** UAR-012

## 产品目标与范围

只保留能反映UBSCore / Triton-Ascend工程反馈速度、门禁稳定性和主要瓶颈的信息。导航仅两个社区、三种规范页；不恢复工作台、固定任务栏、独立数据质量/采集/指标说明页或高级分析面板。必要的截止、样本、排除与来源就地解释。

状态为待逐项核验；关联PR或历史台账不能替代当前代码业务验收。已有实现直接补验，有差距再改代码，避免重复开发；缺证据项保持未勾选。

## 详细需求、实施约束与固定输入

本期“今天（上海时间）”、按批次起点的涉及PR/执行数真实性由EC-007/008验收。本项承接后置独立新PR枚举和无CI新PR核实，不增加本期KPI卡。历史2026-10-21截止17:03:40为7新PR、22涉及PR、45批次=41initial+4rerun；20:53看到14新PR，另外7个晚于该截止，不能称漏采7个。生产数字不固定为样本值。

## 可逐项核对的需求和验收清单

### UAR-012：今天新增 PR、涉及 PR 与执行分别回答

**问题与影响：** E04。当前“涉及PR”是按执行批次选区去重，默认72小时；“24小时”是滚动窗口，并非上海日历日。它们都不能直接回答“今天提交了多少PR”。

**需求要求：** 提供“今天（上海时间）”入口，明确区分新建PR（pr.created_at）、有活动PR、提交批次、重跑批次及workflow-attempt。新增PR须从独立PR列表核实，包含无Actions的新PR，并区分尚无门禁、未触发/策略不要求、证据未采到；不要用initial数量代替新PR。当天截止取数据水位与当前时间的较早值并明示未覆盖时段。

**验收标准：**
- [ ] UAR-012-AC01：E04冻结样本在相同截止显示7个新建PR、22个涉及PR、45批次（41+4）；main/main-dev切换显示对应范围，不把整个72小时76个PR称为今日提交。
- [ ] UAR-012-AC02：构造23:59:59/00:00:00、新PR无CI、旧PR今天推送和重跑、跨时区及截止后创建数据；新PR只计一次，批次/重跑独立计数，未覆盖时段不报零新增。

**测试设计：** 固定上海时钟和源PR清单，与批次列表独立计算；14/7等本轮数字仅用于冻结样本，不做生产固定阈值。

## 交付与证据

逐条记录AC→实际代码SHA→固定输入/来源指纹→操作或命令→预期/实际身份和数值→截图、实际下载或测试报告。文档/静态、模型、真实浏览器、来源对账和公开部署核验分别记录；缺证据标未验证。历史数字仅用于对应冻结输入，不作为每日阈值。

如需改代码，更新相关测试并创建对应Git commit；通过PR合入main。等待python-tests / frontend-tests / collector-contracts / workflow-lint及最终 **Dashboard quality gate** 全绿，保留required_status_checks与required_pull_request_reviews，不直推main或绕过保护；合并后删除临时分支。

## 来源与已有实现

- [2026-10-21-dashboard-user-audit.md](https://github.com/tianli-Backkom/union_monitor/blob/3889c8e4217db60bc3b5e5cde276f8cbd73c2d79/docs/requirements/2026-10-21-dashboard-user-audit.md)


---

<a id="draft-hist-identity"></a>

### [HIST-IDENTITY][P1] 历史回归：可信 PR 关联、强推历史与未知身份恢复

<!-- union-monitor-requirements-20261022 key=HIST-IDENTITY ids=UDR-002 -->

关联总索引：[需求总索引 #17](https://github.com/tianli-Backkom/union_monitor/issues/17)

**优先级：** P1　**范围/状态：** 历史回归／待逐AC核验；后台重构不作为本期展示改造前置

**覆盖原编号：** UDR-002

## 产品目标与范围

只保留能反映UBSCore / Triton-Ascend工程反馈速度、门禁稳定性和主要瓶颈的信息。导航仅两个社区、三种规范页；不恢复工作台、固定任务栏、独立数据质量/采集/指标说明页或高级分析面板。必要的截止、样本、排除与来源就地解释。

状态为待逐项核验；关联PR或历史台账不能替代当前代码业务验收。已有实现直接补验，有差距再改代码，避免重复开发；缺证据项保持未勾选。

## 详细需求、实施约束与固定输入

PR #5包含历史强推与祖先证据修复，仍需按完整AC核验；未关联及歧义保留原run/attempt及来源，不以未知比例必须为零逼迫猜测。

## 可逐项核对的需求和验收清单

### UDR-002：可信 PR 关联与未知身份恢复

**来源：** R01、R08；报告“数据准确性与完整性”。
**优先级：** P1。
**需求描述：** 仅凭明确 run 关联或唯一可信 fork/branch/历史 SHA 证据恢复 PR；标题、时间接近或同分支不足以证明关联。未知与歧义保留独立 run/attempt 身份及原因，不生成伪 PR 链接/共同序号。关联补齐时保留原来源身份和迁移证据，来源请求失败与普通未知分别表达。

**自动化测试用例：**

| 用例 | 输入与操作 | 预期断言 | 关联验收 | 自动化覆盖 |
|---|---|---|---|---|
| UDR-002-TC01 | 输入：同分支多个 PR、不同 fork 同 SHA、未来创建 PR、强推后仅历史 SHA 匹配；操作：通过 Resolver/默认采集入口关联并渲染。 | 只恢复唯一且有证据的关联；历史 SHA 不换成最新 head；无证据/歧义保留未知及来源链接，无 `PR #? 第 N 次` 或空 PR 链接。 | UDR-002-AC01 | 待补充：[身份测试](https://github.com/tianli-Backkom/union_monitor/blob/3889c8e4217db60bc3b5e5cde276f8cbd73c2d79/tests/test_triton_pr_identity.py)、[真实视图身份](https://github.com/tianli-Backkom/union_monitor/blob/3889c8e4217db60bc3b5e5cde276f8cbd73c2d79/tests/triton_lifecycle.test.cjs)。 |
| UDR-002-TC02 | 输入：PR #2513 类同 fork/branch 但历史 SHA 缺证据、API 限流、随后证据补齐；操作：重放两版采集/关联。 | 缺 SHA 证据不宣称恢复；API 失败传播为非成功；后续可恢复时每个 run/attempt 仍只计一次并留下变更记录。 | UDR-002-AC02 | 待新增 `tests/test_pr_identity_recovery.py`；参考[关联质量](https://github.com/tianli-Backkom/union_monitor/blob/3889c8e4217db60bc3b5e5cde276f8cbd73c2d79/tests/test_triton_pr_quality.py)。 |

**验收条件：**

- [ ] UDR-002-AC01：每条恢复记录有可追溯来源证据；未知/歧义记录有稳定身份与原因；不以“未知比例必须为零”逼迫猜测关联。
- [ ] UDR-002-AC02：跨版本恢复可追踪且不重复计数；证据不足和来源故障不会被包装成已核实成功。

## 交付与证据

逐条记录AC→实际代码SHA→固定输入/来源指纹→操作或命令→预期/实际身份和数值→截图、实际下载或测试报告。文档/静态、模型、真实浏览器、来源对账和公开部署核验分别记录；缺证据标未验证。历史数字仅用于对应冻结输入，不作为每日阈值。

如需改代码，更新相关测试并创建对应Git commit；通过PR合入main。等待python-tests / frontend-tests / collector-contracts / workflow-lint及最终 **Dashboard quality gate** 全绿，保留required_status_checks与required_pull_request_reviews，不直推main或绕过保护；合并后删除临时分支。

## 来源与已有实现

- [2026-10-12-unified-dashboard-audit-requirements.md](https://github.com/tianli-Backkom/union_monitor/blob/3889c8e4217db60bc3b5e5cde276f8cbd73c2d79/docs/requirements/2026-10-12-unified-dashboard-audit-requirements.md)

已有实现参考（需逐AC验收，不能据此整项关闭）：[PR #5](https://github.com/tianli-Backkom/union_monitor/pull/5)


---

<a id="draft-hist-contract"></a>

### [HIST-CONTRACT][P1] 历史回归：适配器、完整身份、工件与格式兼容契约

<!-- union-monitor-requirements-20261022 key=HIST-CONTRACT ids=UDR-008,UDR-021,UDR-022,UDR-035 -->

关联总索引：[需求总索引 #17](https://github.com/tianli-Backkom/union_monitor/issues/17)

**优先级：** P1　**范围/状态：** 历史回归／待逐AC核验；后台重构不作为本期展示改造前置

**覆盖原编号：** UDR-008、UDR-021、UDR-022、UDR-035

## 产品目标与范围

只保留能反映UBSCore / Triton-Ascend工程反馈速度、门禁稳定性和主要瓶颈的信息。导航仅两个社区、三种规范页；不恢复工作台、固定任务栏、独立数据质量/采集/指标说明页或高级分析面板。必要的截止、样本、排除与来源就地解释。

状态为待逐项核验；关联PR或历史台账不能替代当前代码业务验收。已有实现直接补验，有差距再改代码，避免重复开发；缺证据项保持未勾选。

## 详细需求、实施约束与固定输入

保持真实默认collector/validator与完整身份，JSON/原CSV/资格sidecar逐身份一致。UDR-035真实old/new CLI同输入字节级shadow及UBS来源证据曾不足，取得前保持未验证。同名仓/同号PR/不同attempt不得合并；旧schema/profile不冒充新版。

## 可逐项核对的需求和验收清单

### UDR-008：JSON、原 CSV、资格文件与指纹一致

**来源：** R01；报告发布一致性；技术 T-010、T-013。
**优先级：** P1。
**需求描述：** 数据 JSON、原 CSV、资格 sidecar 属于同一快照，逐身份/字段可核对。保留 Triton 原 16 列/秒单位与 UBS 原毫秒格式，资格单独版本化。新 manifest 绑定资格文件字节哈希；旧 manifest 无此字段只按旧契约兼容。

**自动化测试用例：**

| 用例 | 输入与操作 | 预期断言 | 关联验收 | 自动化覆盖 |
|---|---|---|---|---|
| UDR-008-TC01 | 输入：一个已知及一个未知 PR 批次；操作：生成、解析 JSON/CSV/资格文件并比较。 | CSV 按 JSON 顺序逐行核对 16 字段，保持列名/秒单位/空值；JSON 与资格文件按 id/run-attempt 严格核对；旧 CSV 无 id/attempt 列，不宣称可单独恢复稳定身份；版本/时间一致。 | UDR-008-AC01 | 现有：[资格 sidecar 与兼容 CSV](https://github.com/tianli-Backkom/union_monitor/blob/3889c8e4217db60bc3b5e5cde276f8cbd73c2d79/tests/test_triton_audit_gates.py)、[工件一致性](https://github.com/tianli-Backkom/union_monitor/blob/3889c8e4217db60bc3b5e5cde276f8cbd73c2d79/tests/test_triton_quality.py)。 |
| UDR-008-TC02 | 输入：逐项删 CSV 行、改耗时/资格/时间、缺 sidecar、畸形 hash、混入旧版文件及旧 manifest；操作：执行发布前与部署后验证。 | 新契约不一致均失败并指出文件；旧契约可兼容但不得报告 sidecar 已验证；不把公开自洽当预期构建核验。 | UDR-008-AC02 | 待补充：[工件验证](https://github.com/tianli-Backkom/union_monitor/blob/3889c8e4217db60bc3b5e5cde276f8cbd73c2d79/tests/test_triton_quality.py)、[公开核验](https://github.com/tianli-Backkom/union_monitor/blob/3889c8e4217db60bc3b5e5cde276f8cbd73c2d79/tests/test_verify_deployment.py)完整故障参数矩阵。 |

**验收条件：**

- [ ] UDR-008-AC01：相关资源实体、条数、字段、单位、时间及版本一致，旧解析器兼容。
- [ ] UDR-008-AC02：任一新契约资源缺失/篡改/混版被拒绝；部署后验证比较实际公开字节与预期构建指纹。

### UDR-021：真实适配器协议与验证结果传播

**来源：** R05；技术 T-003、T-008、T-015。
**优先级：** P1。
**需求描述：** 统一 collect 使用真实 collector 参数/返回协议并执行项目验证器；Triton cutoff 转为合法 ISO，不将已构建 payload 当 runs 再聚合。真实采集时间保留。来源错误、缺证据、质量失败不能默认 passed；未知仓库不冒用 Triton 归属，诊断成功数据不等于成功发布。

**自动化测试用例：**

| 用例 | 输入与操作 | 预期断言 | 关联验收 | 自动化覆盖 |
|---|---|---|---|---|
| UDR-021-TC01 | 输入：受控空 Actions 传输响应、固定 context；操作：调用默认 adapter 的实际 collect/quality。 | 参数为 collector 接受的 ISO；返回 payload 按真实协议消费；零数据成功且验证实际执行，collected_at 不改成 cutoff。 | UDR-021-AC01 | 现有：[默认适配器集成](https://github.com/tianli-Backkom/union_monitor/blob/3889c8e4217db60bc3b5e5cde276f8cbd73c2d79/tests/test_monitor_adapter_integration.py)。 |
| UDR-021-TC02 | 输入：UBS meta.errors、缺 job 证据、未配置 validator、请求非目标仓；操作：执行统一采集入口。 | collection/validation 非成功、退出非零、错误可定位来源/仓库；无默认 passed，无错仓重标；成功片段只作诊断。 | UDR-021-AC02 | 待补充：[默认适配器集成](https://github.com/tianli-Backkom/union_monitor/blob/3889c8e4217db60bc3b5e5cde276f8cbd73c2d79/tests/test_monitor_adapter_integration.py)、[适配器](https://github.com/tianli-Backkom/union_monitor/blob/3889c8e4217db60bc3b5e5cde276f8cbd73c2d79/tests/test_monitor_adapters.py)已有边界，补真实 CLI 退出断言。 |

**验收条件：**

- [ ] UDR-021-AC01：真实默认 adapter 与 collector/validator 边界通过，合法空数据可成功，原观察时间和实际配置可追踪。
- [ ] UDR-021-AC02：所有错误路径保持非成功及正确归属；替换整个 runner 的 fake 测试不能替代该验收。

### UDR-022：项目工件隔离与可信加载

**来源：** R06；技术 T-012、T-013。
**优先级：** P1。
**需求描述：** 工件按项目/run attempt 独立命名和下载，同名 report/snapshot 不扁平覆盖。加载器核对启用项目集合、归属、run/SHA/配置/窗口、实际文件和字节 hash；缺报告显式失败，重复/越界/错误文件拒绝，不采用最后写入胜出。

**自动化测试用例：**

| 用例 | 输入与操作 | 预期断言 | 关联验收 | 自动化覆盖 |
|---|---|---|---|---|
| UDR-022-TC01 | 输入：两项目都上传 snapshot.json/collection-report.json；操作：执行受控工件传输/实际 shadow 下载后加载，另缺一个 report。 | 两份资源均保留且归属正确；缺 report 是该项目失败，另一项目结果仍保留，不当合法空数据。 | UDR-022-AC01 | 待补充：[工件加载](https://github.com/tianli-Backkom/union_monitor/blob/3889c8e4217db60bc3b5e5cde276f8cbd73c2d79/tests/test_monitor_artifacts.py)、[影子工作流](https://github.com/tianli-Backkom/union_monitor/blob/3889c8e4217db60bc3b5e5cde276f8cbd73c2d79/tests/test_unified_workflow.py)当前模拟目录，补实际传输/下载证据。 |
| UDR-022-TC02 | 输入：重复 report、旧 attempt、错 SHA/窗口/归属、缺资源、错 hash、路径逃逸、未知/禁用项目；操作：加载候选输入。 | 拒绝非法输入并报告具体项目/字段；无跨运行覆盖或错版本 fresh。 | UDR-022-AC02 | 待补充：[工件攻击测试](https://github.com/tianli-Backkom/union_monitor/blob/3889c8e4217db60bc3b5e5cde276f8cbd73c2d79/tests/test_monitor_artifacts.py)的 attempt/目录指纹完整矩阵。 |

**验收条件：**

- [ ] UDR-022-AC01：上传/下载/加载全链不发生同名覆盖，缺报告状态真实并进入整轮报告。
- [ ] UDR-022-AC02：所有工件身份/版本/实际字节检查执行，不可信资源不能进入后续装配。

### UDR-035：稳定公共身份、能力与版本化度量契约

**来源：** 报告“架构需求完成情况”；技术 T-002、T-003、T-008、T-009、T-016。
**优先级：** P1。
**需求描述：** 项目目录提供稳定 ID、仓列表、collector/profile、窗口、超时/缓存版本、验证和展示能力。仓身份含源实例与完整路径，PR/批次/任务复合身份保留 attempt 等扩展。公共模型使用毫秒并保留源精度/单位，元信息定义粒度/时间依据/起终点/资格/n/算法版本；读旧 schema/profile 必须明确兼容，不能重贴当前定义。

**自动化测试用例：**

| 用例 | 输入与操作 | 预期断言 | 关联验收 | 自动化覆盖 |
|---|---|---|---|---|
| UDR-035-TC01 | 输入：两源实例同路径、不同组织同仓名、同号 PR、同 SHA 不同仓/PR、异源相同 run/job 数值及多 attempt；操作：规范化、去重、关联、序列化/加载。 | 复合身份按项目/源实例/完整仓库/所属实体隔离，不按裸 SHA/run/job 串联；重复同身份去重，不同 attempt 保留；源路径规则和扩展证据未丢失。 | UDR-035-AC01 | 待补充：[身份](https://github.com/tianli-Backkom/union_monitor/blob/3889c8e4217db60bc3b5e5cde276f8cbd73c2d79/tests/test_monitor_identity.py)、[目录](https://github.com/tianli-Backkom/union_monitor/blob/3889c8e4217db60bc3b5e5cde276f8cbd73c2d79/tests/test_monitor_catalog.py)到公共数据/页面关联。 |
| UDR-035-TC02 | 输入：毫秒/秒/亚秒/未知、旧schema/profile、兼容snapshot和缺能力；操作：新旧CLI同输入采集、读取data/snapshot.json、比较指标/原CSV及页面定义。 | 换算保精度、未知不补零；CLI和兼容快照可读，同语义下样本/代表/统计/旧CSV一致；语义变化升profile版本，旧定义不重贴当前版本；不兼容明确拒绝/不可用。 | UDR-035-AC02 | 待补充：[公共时长](https://github.com/tianli-Backkom/union_monitor/blob/3889c8e4217db60bc3b5e5cde276f8cbd73c2d79/tests/test_monitor_duration.py)、[度量定义](https://github.com/tianli-Backkom/union_monitor/blob/3889c8e4217db60bc3b5e5cde276f8cbd73c2d79/tests/test_monitor_metrics.py)与版本/CLI迁移集成。 |

**验收条件：**

- [ ] UDR-035-AC01：公共身份/能力契约可支撑异源与多社区，关联/去重严格按完整稳定身份。
- [ ] UDR-035-AC02：保留源精度与完整度量定义；旧CLI/兼容snapshot/原CSV可用，同语义迁移结果一致，语义变化有新版profile且旧版不伪装新语义。

## 交付与证据

逐条记录AC→实际代码SHA→固定输入/来源指纹→操作或命令→预期/实际身份和数值→截图、实际下载或测试报告。文档/静态、模型、真实浏览器、来源对账和公开部署核验分别记录；缺证据标未验证。历史数字仅用于对应冻结输入，不作为每日阈值。

如需改代码，更新相关测试并创建对应Git commit；通过PR合入main。等待python-tests / frontend-tests / collector-contracts / workflow-lint及最终 **Dashboard quality gate** 全绿，保留required_status_checks与required_pull_request_reviews，不直推main或绕过保护；合并后删除临时分支。

## 来源与已有实现

- [2026-10-12-unified-dashboard-audit-requirements.md](https://github.com/tianli-Backkom/union_monitor/blob/3889c8e4217db60bc3b5e5cde276f8cbd73c2d79/docs/requirements/2026-10-12-unified-dashboard-audit-requirements.md)

已有实现参考（需逐AC验收，不能据此整项关闭）：[PR #2](https://github.com/tianli-Backkom/union_monitor/pull/2)


---

<a id="draft-hist-legacy"></a>

### [HIST-LEGACY][P1] 历史回归：legacy UBS 九仓失败必须阻断伪成功发布

<!-- union-monitor-requirements-20261022 key=HIST-LEGACY ids=UDR-023 -->

关联总索引：[需求总索引 #17](https://github.com/tianli-Backkom/union_monitor/issues/17)

**优先级：** P1　**范围/状态：** 历史回归／待逐AC核验；后台重构不作为本期展示改造前置

**覆盖原编号：** UDR-023

## 产品目标与范围

只保留能反映UBSCore / Triton-Ascend工程反馈速度、门禁稳定性和主要瓶颈的信息。导航仅两个社区、三种规范页；不恢复工作台、固定任务栏、独立数据质量/采集/指标说明页或高级分析面板。必要的截止、样本、排除与来源就地解释。

状态为待逐项核验；关联PR或历史台账不能替代当前代码业务验收。已有实现直接补验，有差距再改代码，避免重复开发；缺证据项保持未勾选。

## 详细需求、实施约束与固定输入

只适用于仍使用legacy整站发布阶段；切到可信分社区回退协议后按UDR-027验收并明确退出，不混用两套失败策略。合法零与failed/partial分开。

## 可逐项核对的需求和验收清单

### UDR-023：迁移前 legacy UBS 采集失败不得伪绿

**来源：** R07；审查“PR 与定时刷新防护”。
**优先级：** P1。
**需求描述：** 每日 legacy 采集后检查配置的九仓集合、索引和实际快照身份/status/meta.errors；任一 failed/partial/缺报告/错误快照阻断本轮整站上传部署并保留诊断。合法零数据 success 不被拒绝。本需求不冒充 UDR-027 的部分成功可信发布。

**自动化测试用例：**

| 用例 | 输入与操作 | 预期断言 | 关联验收 | 自动化覆盖 |
|---|---|---|---|---|
| UDR-023-TC01 | 输入：九仓均 success 且零 PR；操作：执行 scripts/verify_collection_status.py 并检查 workflow 顺序。 | 退出零，九仓完整/唯一；状态检查位于后续上传/部署前，空数据与来源错误区分。 | UDR-023-AC01 | 现有：[legacy 状态门禁](https://github.com/tianli-Backkom/union_monitor/blob/3889c8e4217db60bc3b5e5cde276f8cbd73c2d79/tests/test_collection_status_gate.py)。 |
| UDR-023-TC02 | 输入：任一 failed/partial、索引或真实快照 errors、缺/重复仓、错身份/路径；操作：执行门禁和受控 legacy 构建。 | 非零退出，诊断包含仓与原因；上传/部署调用零，不能靠旧快照或 validate 的 N/A 状态变绿。 | UDR-023-AC02 | 待补充：[状态门禁](https://github.com/tianli-Backkom/union_monitor/blob/3889c8e4217db60bc3b5e5cde276f8cbd73c2d79/tests/test_collection_status_gate.py)到实际构建调用记录。 |

**验收条件：**

- [ ] UDR-023-AC01：legacy 的成功九仓/合法零数据可继续，检查必经且顺序正确。
- [ ] UDR-023-AC02：任一来源/归属异常阻断该构建发布；迁移后改用 UDR-027 规则，并明确退出该临时全站阻断策略。

## 交付与证据

逐条记录AC→实际代码SHA→固定输入/来源指纹→操作或命令→预期/实际身份和数值→截图、实际下载或测试报告。文档/静态、模型、真实浏览器、来源对账和公开部署核验分别记录；缺证据标未验证。历史数字仅用于对应冻结输入，不作为每日阈值。

如需改代码，更新相关测试并创建对应Git commit；通过PR合入main。等待python-tests / frontend-tests / collector-contracts / workflow-lint及最终 **Dashboard quality gate** 全绿，保留required_status_checks与required_pull_request_reviews，不直推main或绕过保护；合并后删除临时分支。

## 来源与已有实现

- [2026-10-12-unified-dashboard-audit-requirements.md](https://github.com/tianli-Backkom/union_monitor/blob/3889c8e4217db60bc3b5e5cde276f8cbd73c2d79/docs/requirements/2026-10-12-unified-dashboard-audit-requirements.md)

已有实现参考（需逐AC验收，不能据此整项关闭）：[PR #2](https://github.com/tianli-Backkom/union_monitor/pull/2)


---

<a id="draft-hist-schedule"></a>

### [HIST-SCHEDULE][P1] 历史架构：统一生产上下文、整轮排队与防旧版本覆盖

<!-- union-monitor-requirements-20261022 key=HIST-SCHEDULE ids=UDR-024,UDR-025 -->

关联总索引：[需求总索引 #17](https://github.com/tianli-Backkom/union_monitor/issues/17)

**优先级：** P1　**范围/状态：** 历史回归／待逐AC核验；后台重构不作为本期展示改造前置

**覆盖原编号：** UDR-024、UDR-025

## 产品目标与范围

只保留能反映UBSCore / Triton-Ascend工程反馈速度、门禁稳定性和主要瓶颈的信息。导航仅两个社区、三种规范页；不恢复工作台、固定任务栏、独立数据质量/采集/指标说明页或高级分析面板。必要的截止、样本、排除与来源就地解释。

状态为待逐项核验；关联PR或历史台账不能替代当前代码业务验收。已有实现直接补验，有差距再改代码，避免重复开发；缺证据项保持未勾选。

## 详细需求、实施约束与固定输入

保留历史架构及已有实现回归，不因建Issue新增或修改生产调度。文档07:30及窗口/超时为该版迁移基线，应核对当前workflow/catalog及切换证据，不同时保留两个生产入口。UDR-024-AC01真实shadow/legacy同输入对照没有证据前不得用合成测试代替。

## 可逐项核对的需求和验收清单

### UDR-024：单一生产调度、共享截止与全任务等待

**来源：** R10；报告“架构需求完成情况”；技术 T-002、T-003、T-012。
**优先级：** P1。
**需求描述：** 一个生产工作流每日北京时间 07:30（`30 23 * * *`）或手动补采启动，目录生成全部启用社区 Matrix。prepare 一次固定带时区 cutoff、run/attempt、代码 SHA、配置指纹与启用集合；UBS 720 小时、Triton 72 小时，各自观察时间保留。初始 max-parallel=2、fail-fast=false；UBS 九仓在同一社区作业内处理，禁止多个作业共享可写 SQLite。社区独立限速/重试，作业超时为 UBS 180/Triton 60 分钟。前置检查先于采集，汇总等待全部项目结束；切换后移除旧独立生产定时/部署入口。

**自动化测试用例：**

| 用例 | 输入与操作 | 预期断言 | 关联验收 | 自动化覆盖 |
|---|---|---|---|---|
| UDR-024-TC01 | 输入：UBS/Triton 启用、第三项目禁用，同 context 但 adapter 晚两小时开始；操作：从 plan/collect 到统一编排并枚举生产 workflow。 | 唯一生产 schedule、恰调用两个项目；九仓不分写库作业；截止相同且窗口 720/72 小时，observed/collected 时间真实。 | UDR-024-AC01 | 待新增 `tests/test_unified_production_workflow.py`；参考[计划](https://github.com/tianli-Backkom/union_monitor/blob/3889c8e4217db60bc3b5e5cde276f8cbd73c2d79/tests/test_monitor_plan.py)、[上下文](https://github.com/tianli-Backkom/union_monitor/blob/3889c8e4217db60bc3b5e5cde276f8cbd73c2d79/tests/test_monitor_context.py)。 |
| UDR-024-TC02 | 输入：一社区成功、另一限流/超时/缺报告，测试请求 timeout=1秒、max_attempts=3、backoff=0.25秒；另测前置失败/取消；操作：以虚拟时钟驱动真实编排至配置预算。 | 成功社区继续，汇总晚于全部终结；第2次恢复仅请求2次，持续失败不超3次；作业期限按配置终结，不真实等待180分钟；前置失败/取消无采集或部署副作用。 | UDR-024-AC02 | 待新增编排事件/超时集成测试；上述为测试配置，生产预算由项目配置声明；[shadow 文本检查](https://github.com/tianli-Backkom/union_monitor/blob/3889c8e4217db60bc3b5e5cde276f8cbd73c2d79/tests/test_unified_workflow.py)不替代。 |

**验收条件：**

- [ ] UDR-024-AC01：每日生产入口唯一且共享上下文；同输入下真实 shadow 与 legacy 的窗口/样本身份/代表/统计/原 CSV 对照一致后切换，语义变化须版本化说明。
- [ ] UDR-024-AC02：并行故障隔离、等待屏障和前置/取消规则实际执行，固定 cutoff 不因开始时间漂移；历史补采默认仅产审计工件，不覆盖较新发布。

### UDR-025：整轮排队与防旧版本覆盖

**来源：** R12；报告架构/并发差距；技术 T-012、T-013。
**优先级：** P1。
**需求描述：** 生产固定并发组、cancel-in-progress=false、queue: max；prepare 到提升/回滚处于同一发布锁。装配/部署前重读 verified 基线，旧 cutoff 不覆盖新版本；同 cutoff 按批准的同 run 更高 attempt/兼容规则处理。已接受部署后取消，下轮先协调公开状态与 pointer，不能当未部署。

**自动化测试用例：**

| 用例 | 输入与操作 | 预期断言 | 关联验收 | 自动化覆盖 |
|---|---|---|---|---|
| UDR-025-TC01 | 输入：一轮慢采集并连续触发后两轮；操作：受控调度执行直到完成。 | 在途轮不取消，后两轮排队而非互相替换；部署/提升/回滚写入互斥；平台队列上限另有明确边界。 | UDR-025-AC01 | 待新增 `tests/test_release_concurrency.py`；[现有 workflow 测试](https://github.com/tianli-Backkom/union_monitor/blob/3889c8e4217db60bc3b5e5cde276f8cbd73c2d79/tests/test_triton_workflow.py)验证的是旧 pending 策略。 |
| UDR-025-TC02 | 输入：旧 cutoff 等待期间基线变新、低 attempt/历史补采、部署被接受后取消；操作：在发布/恢复前重读状态并进入下一轮。 | 旧候选/旧回滚部署零次；同截止仅允许符合规则的更高 attempt；不一致 pointer/公开状态先协调再部署。 | UDR-025-AC02 | 待新增版本竞态/中断协调集成测试；列表排序/分页模型不作为发布排序证据。 |

**验收条件：**

- [ ] UDR-025-AC01：可容纳范围内的整轮触发排队，无在途取消或并发站点写入，不承诺无限容量/永不丢定时事件。
- [ ] UDR-025-AC02：旧版本与不合格 attempt 无法覆盖新基线；中断后的真实已部署状态可识别并协调。

## 交付与证据

逐条记录AC→实际代码SHA→固定输入/来源指纹→操作或命令→预期/实际身份和数值→截图、实际下载或测试报告。文档/静态、模型、真实浏览器、来源对账和公开部署核验分别记录；缺证据标未验证。历史数字仅用于对应冻结输入，不作为每日阈值。

如需改代码，更新相关测试并创建对应Git commit；通过PR合入main。等待python-tests / frontend-tests / collector-contracts / workflow-lint及最终 **Dashboard quality gate** 全绿，保留required_status_checks与required_pull_request_reviews，不直推main或绕过保护；合并后删除临时分支。

## 来源与已有实现

- [2026-10-12-unified-dashboard-audit-requirements.md](https://github.com/tianli-Backkom/union_monitor/blob/3889c8e4217db60bc3b5e5cde276f8cbd73c2d79/docs/requirements/2026-10-12-unified-dashboard-audit-requirements.md)

已有实现参考（需逐AC验收，不能据此整项关闭）：[PR #2](https://github.com/tianli-Backkom/union_monitor/pull/2)


---

<a id="draft-hist-bundle"></a>

### [HIST-BUNDLE][P1] 历史回归：公共装配校验完整发布束及资源引用闭包

<!-- union-monitor-requirements-20261022 key=HIST-BUNDLE ids=UDR-026 -->

关联总索引：[需求总索引 #17](https://github.com/tianli-Backkom/union_monitor/issues/17)

**优先级：** P1　**范围/状态：** 历史回归／待逐AC核验；后台重构不作为本期展示改造前置

**覆盖原编号：** UDR-026

## 产品目标与范围

只保留能反映UBSCore / Triton-Ascend工程反馈速度、门禁稳定性和主要瓶颈的信息。导航仅两个社区、三种规范页；不恢复工作台、固定任务栏、独立数据质量/采集/指标说明页或高级分析面板。必要的截止、样本、排除与来源就地解释。

状态为待逐项核验；关联PR或历史台账不能替代当前代码业务验收。已有实现直接补验，有差距再改代码，避免重复开发；缺证据项保持未勾选。

## 详细需求、实施约束与固定输入

真实assemble公共入口必须独立验证，不仅信success/fresh字段。精简后HTML/JS/CSS实际依赖进入完整束，删除旧模板不授权删除来源/资格资源验证。

## 可逐项核对的需求和验收清单

### UDR-026：公共装配与完整发布束校验

**来源：** R12；技术 T-013。
**优先级：** P1。
**需求描述：** 任何 assemble 调用独立验证 fresh 输入与实际资源，不能仅信 success 字段。唯一装配器生成完整站点 manifest，绑定 context/catalog/report，列出公共 JSON/CSV/资格/索引和 HTML/JS/CSS 等必需文件的归属、大小、哈希和引用闭包。无同项目混版；冻结 manifest 上线后不改写，核验结果由外部 receipt 表达。

**自动化测试用例：**

| 用例 | 输入与操作 | 预期断言 | 关联验收 | 自动化覆盖 |
|---|---|---|---|---|
| UDR-026-TC01 | 输入：正确完整候选；操作：公共 assemble CLI→本地完整束校验→publishable candidate→受控部署→公开核验→receipt，独立重算字节/大小/引用闭包。 | 资源集合/归属/版本匹配；本地通过才允许候选部署，公开通过才产生成功receipt；冻结manifest字节不变，发布前/后验证不倒置。 | UDR-026-AC01 | 待新增 `tests/test_release_bundle.py`；参考[装配模型](https://github.com/tianli-Backkom/union_monitor/blob/3889c8e4217db60bc3b5e5cde276f8cbd73c2d79/tests/test_monitor_assemble.py)。 |
| UDR-026-TC02 | 输入：伪成功 report 但错 run/SHA/cutoff/配置、缺真实文件/CSV/sidecar/运行资源、错 hash、额外项目/混版；操作：绕过加载器直接 assemble。 | 非零退出、无可部署完整束，问题命名字段/文件；不能假设前层已经验证或缩减 manifest 验证集合。 | UDR-026-AC02 | 待新增公共 CLI 攻击与完整站点闭包测试；[工件加载](https://github.com/tianli-Backkom/union_monitor/blob/3889c8e4217db60bc3b5e5cde276f8cbd73c2d79/tests/test_monitor_artifacts.py)不替代此入口。 |

**验收条件：**

- [ ] UDR-026-AC01：完整束及引用集合可独立验证，同项目版本一致，冻结 manifest 不被状态提升修改。
- [ ] UDR-026-AC02：直接调用公共入口也拒绝所有伪 fresh/坏文件/缺资源/混版输入，完整束不合法时部署调用零。

## 交付与证据

逐条记录AC→实际代码SHA→固定输入/来源指纹→操作或命令→预期/实际身份和数值→截图、实际下载或测试报告。文档/静态、模型、真实浏览器、来源对账和公开部署核验分别记录；缺证据标未验证。历史数字仅用于对应冻结输入，不作为每日阈值。

如需改代码，更新相关测试并创建对应Git commit；通过PR合入main。等待python-tests / frontend-tests / collector-contracts / workflow-lint及最终 **Dashboard quality gate** 全绿，保留required_status_checks与required_pull_request_reviews，不直推main或绕过保护；合并后删除临时分支。

## 来源与已有实现

- [2026-10-12-unified-dashboard-audit-requirements.md](https://github.com/tianli-Backkom/union_monitor/blob/3889c8e4217db60bc3b5e5cde276f8cbd73c2d79/docs/requirements/2026-10-12-unified-dashboard-audit-requirements.md)

已有实现参考（需逐AC验收，不能据此整项关闭）：[PR #2](https://github.com/tianli-Backkom/union_monitor/pull/2)


---

<a id="draft-hist-fallback"></a>

### [HIST-FALLBACK][P1] 历史回归：可信旧束回退、全失败保留与 verified 原子提升

<!-- union-monitor-requirements-20261022 key=HIST-FALLBACK ids=UDR-027,UDR-028 -->

关联总索引：[需求总索引 #17](https://github.com/tianli-Backkom/union_monitor/issues/17)

**优先级：** P1　**范围/状态：** 历史回归／待逐AC核验；后台重构不作为本期展示改造前置

**覆盖原编号：** UDR-027、UDR-028

## 产品目标与范围

只保留能反映UBSCore / Triton-Ascend工程反馈速度、门禁稳定性和主要瓶颈的信息。导航仅两个社区、三种规范页；不恢复工作台、固定任务栏、独立数据质量/采集/指标说明页或高级分析面板。必要的截止、样本、排除与来源就地解释。

状态为待逐项核验；关联PR或历史台账不能替代当前代码业务验收。已有实现直接补验，有差距再改代码，避免重复开发；缺证据项保持未勾选。

## 详细需求、实施约束与固定输入

fresh/fallback/unavailable保持真实时间和版本。旧束仅限已核验且兼容的持久资源；指针引用资源损坏为基线故障，不能当首次无旧数据。归档和原子pointer提升须在公开实际核验之后。

## 可逐项核对的需求和验收清单

### UDR-027：部分失败可信回退与首次/全失败策略

**来源：** R07、R12；技术 T-013；产品 P-013。
**优先级：** P1。
**需求描述：** 等全部任务结束后，验证通过的新数据 fresh；失败项目只有从可信 verified 归档恢复且 schema/profile 可读的旧数据才 fallback，无该项目可信旧数据则 unavailable。已有权威 pointer 但引用资源损坏属于基线故障，整轮阻断，不能改称首次/项目无旧数据后继续发布。旧身份/profile/窗口/采集时间保留，任务仍失败。基线合法且至少一项目成功可降级发布，合法零为 fresh；全失败保留整站上一完整版本，首次全失败不发布；旧窗口不进入同窗比较。

**自动化测试用例：**

| 用例 | 输入与操作 | 预期断言 | 关联验收 | 自动化覆盖 |
|---|---|---|---|---|
| UDR-027-TC01 | 输入：成功/失败/超时/缺报告/合法零与有/无可信旧束的故障表；操作：从 collect→assemble→受控发布→浏览器显示逐行执行。 | 成功更新、失败按 fallback/unavailable 表达；旧时间/profile 不改；首次一成功一失败可发布，首次全失败不部署，零数据 fresh；失败不是全部采集成功。 | UDR-027-AC01 | 待新增 `tests/test_degraded_release.py` 与页面故障矩阵；参考[状态模型](https://github.com/tianli-Backkom/union_monitor/blob/3889c8e4217db60bc3b5e5cde276f8cbd73c2d79/tests/test_monitor_status_view.py)。 |
| UDR-027-TC02 | 输入：全失败有上一完整束、伪 verified/candidate、旧窗口、不可读 profile，另测一项 fresh但权威 pointer 引用归档缺失/坏 hash；操作：回退和汇总。 | 全失败不新部署；伪/不可读资源不冒充fallback；旧窗不参加同窗比较；权威基线损坏即使另一项fresh也部署零次，报告基线故障。 | UDR-027-AC02 | 待新增可信基线回退攻击测试；[字典装配测试](https://github.com/tianli-Backkom/union_monitor/blob/3889c8e4217db60bc3b5e5cde276f8cbd73c2d79/tests/test_monitor_assemble.py)不足以完成验收。 |

**验收条件：**

- [ ] UDR-027-AC01：生产故障表逐行有自动化证据，成功社区更新与失败结论并存；首次不可用、合法零和采集失败可区别。
- [ ] UDR-027-AC02：全失败保留上一完整站点；只有实际可验证兼容旧束可回退，旧语义/时间不被当前配置覆写。

### UDR-028：持久 verified 基线与原子提升

**来源：** R12；技术 T-013。
**优先级：** P1。
**需求描述：** 完整束/manifest/成功公开核验 receipt 保存为不可变 GitHub Release；dashboard-state/verified.json 指向可恢复 current/previous。顺序为公开核验→归档/复核→非强推原子指针提交。缓存/短期工件过期不影响恢复；有指针却缺资源是基线故障，不是首次启动。

**自动化测试用例：**

| 用例 | 输入与操作 | 预期断言 | 关联验收 | 自动化覆盖 |
|---|---|---|---|---|
| UDR-028-TC01 | 输入：有效候选与上一 verified；操作：对受控 Git/Release/HTTP 服务执行发布、清缓存/短期工件后冷恢复。 | 只有核验及归档复核完成后 pointer 单次非强推提升；current/previous 可下载且指纹正确，冷启动仍能恢复。 | UDR-028-AC01 | 待新增 `tests/test_release_baseline.py`。 |
| UDR-028-TC02 | 输入：verify/归档上传失败、receipt 错 hash、归档缺文件、指针提交冲突或指针存在而 Release 损坏；操作：尝试提升/恢复/清理。 | 不产生伪 verified，不强推、不覆盖并发新指针；明确基线故障；被 current/previous 引用的归档不被清理。 | UDR-028-AC02 | 待新增基线事务故障测试；现有 `mark_verified` 字典赋值不构成通过。 |

**验收条件：**

- [ ] UDR-028-AC01：可信版本以实际持久资源/receipt/pointer 表达，冷恢复成功，提升顺序和写入事务可核对。
- [ ] UDR-028-AC02：事务故障不提升本轮、不强推、不覆盖已更新可信指针；公开/pointer不一致交 UDR-025 协调，资源损坏不改称“无上一版”或随意用缓存。

## 交付与证据

逐条记录AC→实际代码SHA→固定输入/来源指纹→操作或命令→预期/实际身份和数值→截图、实际下载或测试报告。文档/静态、模型、真实浏览器、来源对账和公开部署核验分别记录；缺证据标未验证。历史数字仅用于对应冻结输入，不作为每日阈值。

如需改代码，更新相关测试并创建对应Git commit；通过PR合入main。等待python-tests / frontend-tests / collector-contracts / workflow-lint及最终 **Dashboard quality gate** 全绿，保留required_status_checks与required_pull_request_reviews，不直推main或绕过保护；合并后删除临时分支。

## 来源与已有实现

- [2026-10-12-unified-dashboard-audit-requirements.md](https://github.com/tianli-Backkom/union_monitor/blob/3889c8e4217db60bc3b5e5cde276f8cbd73c2d79/docs/requirements/2026-10-12-unified-dashboard-audit-requirements.md)

已有实现参考（需逐AC验收，不能据此整项关闭）：[PR #2](https://github.com/tianli-Backkom/union_monitor/pull/2)


---

<a id="draft-hist-deploy"></a>

### [HIST-DEPLOY][P1] 历史回归：部署后比较公开实际字节并执行可验证恢复

<!-- union-monitor-requirements-20261022 key=HIST-DEPLOY ids=UDR-029,UDR-030 -->

关联总索引：[需求总索引 #17](https://github.com/tianli-Backkom/union_monitor/issues/17)

**优先级：** P1　**范围/状态：** 历史回归／待逐AC核验；后台重构不作为本期展示改造前置

**覆盖原编号：** UDR-029、UDR-030

## 产品目标与范围

只保留能反映UBSCore / Triton-Ascend工程反馈速度、门禁稳定性和主要瓶颈的信息。导航仅两个社区、三种规范页；不恢复工作台、固定任务栏、独立数据质量/采集/指标说明页或高级分析面板。必要的截止、样本、排除与来源就地解释。

状态为待逐项核验；关联PR或历史台账不能替代当前代码业务验收。已有实现直接补验，有差距再改代码，避免重复开发；缺证据项保持未勾选。

## 详细需求、实施约束与固定输入

健康检查、候选对象自洽或函数返回passed不替代公开实际字节对照。回滚须实际恢复部署并再次核验公开字节。故障验证用隔离环境，不在生产或main故意破坏。

## 可逐项核对的需求和验收清单

### UDR-029：公共部署核验比较实际公开字节

**来源：** R12；技术 T-013。
**优先级：** P1。
**需求描述：** 以候选完整 manifest 为预期，访问实际公开文件字节，校验完整项目/资源集合、身份、路径、窗口、版本与指纹；不能只比较几项 manifest 字段。有限请求/重试预算，诊断含 URL/预期/实际/时刻，验证成功才生成 receipt 并允许提升。

**自动化测试用例：**

| 用例 | 输入与操作 | 预期断言 | 关联验收 | 自动化覆盖 |
|---|---|---|---|---|
| UDR-029-TC01 | 输入：本地 HTTP 正确完整束，第1次503/第2次恢复，测试 timeout=1秒、max_attempts=3、backoff=0.25秒；操作：虚拟时钟执行公共 verify CLI/记录请求。 | 必需文件实际读取并匹配预期字节；故障资源2次请求即成功，成功receipt绑定候选/时刻；生产预算由验证器配置声明。 | UDR-029-AC01 | 待新增 `tests/test_public_release_verifier.py`；参考[legacy 逐文件验证](https://github.com/tianli-Backkom/union_monitor/blob/3889c8e4217db60bc3b5e5cde276f8cbd73c2d79/tests/test_verify_deployment.py)。 |
| UDR-029-TC02 | 输入：保留 manifest 改字节/路径/窗口/项目集合、坏/缺 sidecar、新旧格式及持续503；操作：以TC01测试预算公开核验。 | 差异命名资源，持续503最多3次且虚拟时钟不超预算；基线不提升；旧格式不伪报 sidecar 已核验。 | UDR-029-AC02 | 待补充公共 HTTP 攻击矩阵；[monitor 字典测试](https://github.com/tianli-Backkom/union_monitor/blob/3889c8e4217db60bc3b5e5cde276f8cbd73c2d79/tests/test_monitor_verify_rollback.py)不能代替。 |

**验收条件：**

- [ ] UDR-029-AC01：成功记录证明公开实际完整文件与本轮候选一致，而非公开文件彼此自洽。
- [ ] UDR-029-AC02：字节篡改、集合/身份差异及网络耗尽导致真实失败，不会标 verified 或提升基线。

### UDR-030：真实恢复部署和恢复后再次核验

**来源：** R12；技术 T-013。
**优先级：** P1。
**需求描述：** 发布/核验故障后，在同锁中确认失败候选仍在线，取部署前可信完整版本，执行真实恢复部署并再次核验公开字节。不可重新采集充当回滚，不接受 candidate，不能覆盖更近 verified 版本；恢复核验通过后才报告恢复，失败保留实际线上状态/人工入口。

**自动化测试用例：**

| 用例 | 输入与操作 | 预期断言 | 关联验收 | 自动化覆盖 |
|---|---|---|---|---|
| UDR-030-TC01 | 输入：新候选部署后指纹错误、存在可信上一完整束；操作：调用实际回滚编排并记录部署服务/HTTP 字节。 | 使用原完整束而非再采集；来源请求零；旧字节真实恢复，第二次核验成功之后才有恢复成功状态。 | UDR-030-AC01 | 待新增 `tests/test_release_rollback_integration.py`。 |
| UDR-030-TC02 | 输入：candidate 目标、坏/缺归档、恢复部署失败、重验失败或线上已是更近 verified；操作：尝试恢复。 | 不伪报恢复；无效目标拒绝，失败有原因/人工入口；较新线上版本不被旧故障轮覆盖。 | UDR-030-AC02 | 待新增恢复故障矩阵；[现有 rollback 记录测试](https://github.com/tianli-Backkom/union_monitor/blob/3889c8e4217db60bc3b5e5cde276f8cbd73c2d79/tests/test_monitor_verify_rollback.py)不算实际恢复。 |

**验收条件：**

- [ ] UDR-030-AC01：必须有真实恢复部署调用和恢复后公开字节验证证据，记录字典/退出零本身不能验收。
- [ ] UDR-030-AC02：目标/执行/重验失败如实保留失败，旧轮不会破坏更新版本，恢复结果可追溯。

## 交付与证据

逐条记录AC→实际代码SHA→固定输入/来源指纹→操作或命令→预期/实际身份和数值→截图、实际下载或测试报告。文档/静态、模型、真实浏览器、来源对账和公开部署核验分别记录；缺证据标未验证。历史数字仅用于对应冻结输入，不作为每日阈值。

如需改代码，更新相关测试并创建对应Git commit；通过PR合入main。等待python-tests / frontend-tests / collector-contracts / workflow-lint及最终 **Dashboard quality gate** 全绿，保留required_status_checks与required_pull_request_reviews，不直推main或绕过保护；合并后删除临时分支。

## 来源与已有实现

- [2026-10-12-unified-dashboard-audit-requirements.md](https://github.com/tianli-Backkom/union_monitor/blob/3889c8e4217db60bc3b5e5cde276f8cbd73c2d79/docs/requirements/2026-10-12-unified-dashboard-audit-requirements.md)

已有实现参考（需逐AC验收，不能据此整项关闭）：[PR #2](https://github.com/tianli-Backkom/union_monitor/pull/2)


---

<a id="draft-hist-security"></a>

### [HIST-SECURITY][P1] 历史回归：隔离来源缓存、证据、公开资源和发布权限

<!-- union-monitor-requirements-20261022 key=HIST-SECURITY ids=UDR-031 -->

关联总索引：[需求总索引 #17](https://github.com/tianli-Backkom/union_monitor/issues/17)

**优先级：** P1　**范围/状态：** 历史回归／待逐AC核验；后台重构不作为本期展示改造前置

**覆盖原编号：** UDR-031

## 产品目标与范围

只保留能反映UBSCore / Triton-Ascend工程反馈速度、门禁稳定性和主要瓶颈的信息。导航仅两个社区、三种规范页；不恢复工作台、固定任务栏、独立数据质量/采集/指标说明页或高级分析面板。必要的截止、样本、排除与来源就地解释。

状态为待逐项核验；关联PR或历史台账不能替代当前代码业务验收。已有实现直接补验，有差距再改代码，避免重复开发；缺证据项保持未勾选。

## 详细需求、实施约束与固定输入

只验现有缓存与权限边界，不加运维页面。原始日志/SQLite/Secrets不得进入公开站点，缓存不替代持久verified基线。

## 可逐项核对的需求和验收清单

### UDR-031：缓存、来源证据、公开资源与权限边界

**来源：** R12；技术 T-012、T-013。
**优先级：** P1。
**需求描述：** 来源缓存按社区/collector/版本隔离且仅作加速；运行工件、原始来源证据、可信持久发布束职责分离。采集无 Pages/OIDC 发布权限，Secrets 仅用于必要请求且不进入输出。公共资源白名单只含展示数据/必要运行元信息，不含 SQLite/原始缓存/完整日志。

**自动化测试用例：**

| 用例 | 输入与操作 | 预期断言 | 关联验收 | 自动化覆盖 |
|---|---|---|---|---|
| UDR-031-TC01 | 输入：冷缓存、损坏缓存、跨社区/旧 collector 版本缓存，运行工件已过期；操作：从真实 collect 到验证/恢复。 | 冷缓存能正确采集，坏缓存不误发布且不污染其他社区；历史恢复从 verified 持久束取得，不依赖短期缓存。 | UDR-031-AC01 | 待补充：[缓存链](https://github.com/tianli-Backkom/union_monitor/blob/3889c8e4217db60bc3b5e5cde276f8cbd73c2d79/tests/test_cache_chain.py)与 UDR-028 冷恢复集成。 |
| UDR-031-TC02 | 输入：哨兵Secret、含哨兵响应/错误、DB/原始日志；操作：生成/扫描输出并解析job权限/环境，读回dashboard-state写入策略。 | 输出无哨兵/非白名单资源；唯一发布作业使用github-pages环境及受限Pages/OIDC；采集contents只读；只有限定基线主体具必要Contents写权限及状态分支写权。 | UDR-031-AC02 | 待新增 `tests/test_publication_boundaries.py`；参考[PR 权限](https://github.com/tianli-Backkom/union_monitor/blob/3889c8e4217db60bc3b5e5cde276f8cbd73c2d79/tests/test_ci_gate.py)。 |

**验收条件：**

- [ ] UDR-031-AC01：缓存故障不改变数据可信性/社区隔离，缓存不成为唯一历史或可信发布基线。
- [ ] UDR-031-AC02：哨兵扫描与权限/资源清单验证通过，原始证据和敏感信息不在公共站点暴露。

## 交付与证据

逐条记录AC→实际代码SHA→固定输入/来源指纹→操作或命令→预期/实际身份和数值→截图、实际下载或测试报告。文档/静态、模型、真实浏览器、来源对账和公开部署核验分别记录；缺证据标未验证。历史数字仅用于对应冻结输入，不作为每日阈值。

如需改代码，更新相关测试并创建对应Git commit；通过PR合入main。等待python-tests / frontend-tests / collector-contracts / workflow-lint及最终 **Dashboard quality gate** 全绿，保留required_status_checks与required_pull_request_reviews，不直推main或绕过保护；合并后删除临时分支。

## 来源与已有实现

- [2026-10-12-unified-dashboard-audit-requirements.md](https://github.com/tianli-Backkom/union_monitor/blob/3889c8e4217db60bc3b5e5cde276f8cbd73c2d79/docs/requirements/2026-10-12-unified-dashboard-audit-requirements.md)

已有实现参考（需逐AC验收，不能据此整项关闭）：[PR #2](https://github.com/tianli-Backkom/union_monitor/pull/2)


---

<a id="draft-hist-freshness"></a>

### [HIST-FRESHNESS][P1] 区分覆盖截止、采集和读取时间，按实际计划说明迟更

<!-- union-monitor-requirements-20261022 key=HIST-FRESHNESS ids=UDR-032,UDR-033,UAR-013 -->

关联总索引：[需求总索引 #17](https://github.com/tianli-Backkom/union_monitor/issues/17)

**优先级：** P1　**范围/状态：** 历史回归／待逐AC核验；后台重构不作为本期展示改造前置

**覆盖原编号：** UDR-032、UDR-033、UAR-013

## 产品目标与范围

只保留能反映UBSCore / Triton-Ascend工程反馈速度、门禁稳定性和主要瓶颈的信息。导航仅两个社区、三种规范页；不恢复工作台、固定任务栏、独立数据质量/采集/指标说明页或高级分析面板。必要的截止、样本、排除与来源就地解释。

状态为待逐项核验；关联PR或历史台账不能替代当前代码业务验收。已有实现直接补验，有差距再改代码，避免重复开发；缺证据项保持未勾选。

## 详细需求、实施约束与固定输入

EC已删除工作台/采集页、运行矩阵和调度表展示。本项保留后台报告归属、日程一致性、迟更判定；正常页面一条简短时间说明，异常就近提示/来源链接。完整报告、计划启动/下次计划留在后台证据，不搬回主页面。2026-10-21历史样本截止17:03:40、采集17:17:34；重读发布文件不是补采，不更新采集时间。历史计划/宽限与实际workflow/catalog对照，迁移同步页面和健康检查，未知迟更原因不得猜成失败。

## 可逐项核对的需求和验收清单

历史AC→当前验收映射（原文保留在来源文档；以下为按EC新范围调整后的验收，非历史原文）：

### UDR-032：运行报告保留后台，页面只就近表达真实状态

**当前有效要求：** 后台report绑定run/attempt/SHA/目录指纹/cutoff/社区结果退出码/实际时间/样本缺口/错误/缓存；主页面就近区分任务结果、fresh/fallback/unavailable和真实数据时间。工作台/采集页/运行矩阵退役。

**验收标准（按后续EC方案迁移）：**
- [ ] UDR-032-AC01：用户在现存页面可辨各社区数据时间、版本与失败/未知，必要时直达对应Actions/证据；旧数据保留原时间，正常说明简短，不加运维面板。
- [ ] UDR-032-AC02：缺报告/错run或SHA/错归属/跨窗不能产生伪可信结论；旧窗可查但不混同窗池，页面读取成功不当采集成功，reload不补采。

**验证方式：** fresh/fallback/unavailable/合法零、缺报告和错归属固定矩阵，后台结构与当前页面分别验收。

### UDR-033：计划一致的新鲜度与公开健康检查

**来源：** R10；产品 P-012、P-013。
**优先级：** P2。
**需求描述：** 当前以 legacy daily 07:30 和增量 08/12/16/18/20 的实际计划判断，UBS daily 宽限 195 分钟、Triton 增量 90 分钟；未来日更按统一配置/超时/发布宽限判断。界面、workflow、健康脚本同轮更新。公开检查只读指纹/仓状态/真实采集时间，更新索引不能掩盖旧仓，失败保留 JSON/Actions 结论，不补采/部署/伪回滚。

**自动化测试用例：**

| 用例 | 输入与操作 | 预期断言 | 关联验收 | 自动化覆盖 |
|---|---|---|---|---|
| UDR-033-TC01 | 输入：固定上海时钟 08:30/14:30/23:00/午夜及宽限前后，旧/新/缺/无时区/异常未来时间；操作：计算 deadline 并显示。 | 应到槽位正确，宽限内不误报，过期指出项目/计划/实际时间；畸形时间不能健康，夜间不凭空要求次日更新。 | UDR-033-AC01 | 现有：[健康时钟](https://github.com/tianli-Backkom/union_monitor/blob/3889c8e4217db60bc3b5e5cde276f8cbd73c2d79/tests/test_published_health.py)、[页面新鲜度](https://github.com/tianli-Backkom/union_monitor/blob/3889c8e4217db60bc3b5e5cde276f8cbd73c2d79/tests/test_freshness.py)。 |
| UDR-033-TC02 | 输入：新索引但一仓旧/失败、公开错 hash/缺文件/路径逃逸，及未来统一日更配置；操作：运行 HTTP 健康入口并对照全部日程。 | 健康失败且命名仓/文件；无采集/部署调用；迁移后规则一致且不再要求旧五次槽位，失败留诊断。 | UDR-033-AC02 | 待补充：[公开健康](https://github.com/tianli-Backkom/union_monitor/blob/3889c8e4217db60bc3b5e5cde276f8cbd73c2d79/tests/test_published_health.py)与迁移配置联动测试。 |

**验收条件：**

- [ ] UDR-033-AC01：时区/跨日/宽限/时间合法性正确，计划标为启动而不是完成承诺。
- [ ] UDR-033-AC02：公开完整性/每仓新鲜度异常可见，检测与生产配置一致；通过只证明该时刻公开健康，不证明全来源完整或定时永不失败。

历史AC→当前验收映射（原文保留在来源文档；以下为按EC新范围调整后的验收，非历史原文）：

### UAR-013：时间和迟更解释就地呈现

**当前有效要求：** 区分覆盖截止/采集完成/发布时间/最后读取及上海时区，页内最简时间说明和异常提示；计划、最近运行与迟更原因的完整证据保留后台，未知不猜，工作台和调度面板不恢复。

**验收标准（按后续EC方案迁移）：**
- [ ] UAR-013-AC01：历史固定样本显示截止17:03:40与采集17:17:34；截止后时段明确未覆盖，当前总览/合并页/导出时间归属一致。
- [ ] UAR-013-AC02：固定计划时钟和成功/失败/排队/取消/未发现运行/缺报告，按实际配置与宽限判断；原因未知明示；重读成功不当采集成功，不改旧时间。

**验证方式：** workflow/catalog/健康脚本/报告/快照/时钟联动，来源链接可访问；不在生产故意造故障。

## 交付与证据

逐条记录AC→实际代码SHA→固定输入/来源指纹→操作或命令→预期/实际身份和数值→截图、实际下载或测试报告。文档/静态、模型、真实浏览器、来源对账和公开部署核验分别记录；缺证据标未验证。历史数字仅用于对应冻结输入，不作为每日阈值。

如需改代码，更新相关测试并创建对应Git commit；通过PR合入main。等待python-tests / frontend-tests / collector-contracts / workflow-lint及最终 **Dashboard quality gate** 全绿，保留required_status_checks与required_pull_request_reviews，不直推main或绕过保护；合并后删除临时分支。

## 来源与已有实现

- [2026-10-12-unified-dashboard-audit-requirements.md](https://github.com/tianli-Backkom/union_monitor/blob/3889c8e4217db60bc3b5e5cde276f8cbd73c2d79/docs/requirements/2026-10-12-unified-dashboard-audit-requirements.md)
- [2026-10-21-dashboard-user-audit.md](https://github.com/tianli-Backkom/union_monitor/blob/3889c8e4217db60bc3b5e5cde276f8cbd73c2d79/docs/requirements/2026-10-21-dashboard-user-audit.md)

已有实现参考（需逐AC验收，不能据此整项关闭）：[PR #2](https://github.com/tianli-Backkom/union_monitor/pull/2)


---

<a id="draft-hist-third"></a>

### [HIST-THIRD][P2] 后续架构：以真实全链路验证第三社区接入能力

<!-- union-monitor-requirements-20261022 key=HIST-THIRD ids=UDR-034 -->

关联总索引：[需求总索引 #17](https://github.com/tianli-Backkom/union_monitor/issues/17)

**优先级：** P2　**范围/状态：** 后续项／不作为本期精简展示前置

**覆盖原编号：** UDR-034

## 产品目标与范围

只保留能反映UBSCore / Triton-Ascend工程反馈速度、门禁稳定性和主要瓶颈的信息。导航仅两个社区、三种规范页；不恢复工作台、固定任务栏、独立数据质量/采集/指标说明页或高级分析面板。必要的截止、样本、排除与来源就地解释。

状态为待逐项核验；关联PR或历史台账不能替代当前代码业务验收。已有实现直接补验，有差距再改代码，避免重复开发；缺证据项保持未勾选。

## 详细需求、实施约束与固定输入

当前只监控UBSCore/Triton-Ascend。第三社区是历史扩展契约与未来核验，不加本期导航，不要求每社区具备NPU/x86/生命周期；目录/Matrix合成测试不能宣称全链路通过。

## 可逐项核对的需求和验收清单

### UDR-034：第三项目真实全链路接入

**来源：** 报告“架构需求完成情况”：第三项目；产品 P-015；技术 T-015。
**优先级：** P2。
**需求描述：** 第三项目只新增目录与必要 collector/metric/view 注册模块，公共工作流/CLI/路由/加载器不加社区名分支。来源实例、完整仓、目标分支、窗口实际传入；特色能力可缺，不要求 NPU/x86/生命周期。接入必须覆盖真实采集、装配、公开核验、页面和导出。

**自动化测试用例：**

| 用例 | 输入与操作 | 预期断言 | 关联验收 | 自动化覆盖 |
|---|---|---|---|---|
| UDR-034-TC01 | 输入：非 Triton 第三仓、不同分支和 25 小时窗口、本地来源 API；操作：从真实默认 adapter 到发布/浏览器/导出，比较公共代码改动。 | 配置实际生效且 25 小时不被四舍五入成 24；数据归属第三仓，全链通过；公共主流程不新增社区名判断。 | UDR-034-AC01 | 待新增 `tests/test_third_project_end_to_end.py`；[现有目录测试](https://github.com/tianli-Backkom/union_monitor/blob/3889c8e4217db60bc3b5e5cde276f8cbd73c2d79/tests/test_monitor_third_project.py)不足。 |
| UDR-034-TC02 | 输入：异实例/组织同名仓与同号 PR、重复 attempt，第三项目不声明 NPU/生命周期；操作：采集、加载、导航、比较。 | 身份隔离不重复；不读固定 Triton 仓；未声明能力不产零 KPI/伪筛选，有未提供说明。 | UDR-034-AC02 | 待新增第三项目身份/能力整页测试；参考[公共身份](https://github.com/tianli-Backkom/union_monitor/blob/3889c8e4217db60bc3b5e5cde276f8cbd73c2d79/tests/test_monitor_identity.py)。 |

**验收条件：**

- [ ] UDR-034-AC01：配置/注册即可接入实际来源到公开与用户路径，仓/分支/窗口不被固定实现偷换。
- [ ] UDR-034-AC02：同名/同号/重跑隔离，能力按配置呈现；只有目录/Matrix 绿色不能关闭此需求。

## 交付与证据

逐条记录AC→实际代码SHA→固定输入/来源指纹→操作或命令→预期/实际身份和数值→截图、实际下载或测试报告。文档/静态、模型、真实浏览器、来源对账和公开部署核验分别记录；缺证据标未验证。历史数字仅用于对应冻结输入，不作为每日阈值。

如需改代码，更新相关测试并创建对应Git commit；通过PR合入main。等待python-tests / frontend-tests / collector-contracts / workflow-lint及最终 **Dashboard quality gate** 全绿，保留required_status_checks与required_pull_request_reviews，不直推main或绕过保护；合并后删除临时分支。

## 来源与已有实现

- [2026-10-12-unified-dashboard-audit-requirements.md](https://github.com/tianli-Backkom/union_monitor/blob/3889c8e4217db60bc3b5e5cde276f8cbd73c2d79/docs/requirements/2026-10-12-unified-dashboard-audit-requirements.md)

已有实现参考（需逐AC验收，不能据此整项关闭）：[PR #2](https://github.com/tianli-Backkom/union_monitor/pull/2)


---

<a id="draft-hist-docs"></a>

### [HIST-DOCS][P2] 同步 README、离线引导与实际页面、数据口径和迁移状态

<!-- union-monitor-requirements-20261022 key=HIST-DOCS ids=UDR-037 -->

关联总索引：[需求总索引 #17](https://github.com/tianli-Backkom/union_monitor/issues/17)

**优先级：** P2　**范围/状态：** 历史回归／待逐AC核验；后台重构不作为本期展示改造前置

**覆盖原编号：** UDR-037

## 产品目标与范围

只保留能反映UBSCore / Triton-Ascend工程反馈速度、门禁稳定性和主要瓶颈的信息。导航仅两个社区、三种规范页；不恢复工作台、固定任务栏、独立数据质量/采集/指标说明页或高级分析面板。必要的截止、样本、排除与来源就地解释。

状态为待逐项核验；关联PR或历史台账不能替代当前代码业务验收。已有实现直接补验，有差距再改代码，避免重复开发；缺证据项保持未勾选。

## 详细需求、实施约束与固定输入

文档展示以EC精简架构和PSG提交时间定义为准，不恢复旧菜单。区分已上线/待核验/未来能力，离线启动成功不等于今日生产来源完整。

## 可逐项核对的需求和验收清单

### UDR-037：简洁可用且与实际行为一致的文档

**来源：** R11；产品 P-016。
**优先级：** P2。
**需求描述：** README 按在线入口→离线启动→筛选/口径→当前生产/迁移状态→验证/恢复入口组织。默认开发数据从统一站 JSON 获取，显式旧 HTML 兼容。指标和命令与实际能力/日程一致，历史设计基线不伪改成当前，重载不补采，统一导出/回滚未完成时明确说明。

**自动化测试用例：**

| 用例 | 输入与操作 | 预期断言 | 关联验收 | 自动化覆盖 |
|---|---|---|---|---|
| UDR-037-TC01 | 输入：README/设计/工作流/目录；操作：解析本地链接和日程、扫描在线入口与度量说明。 | 链接存在、无地址占位；当前日程与配置相符；S/L、取消差异、P90 非 SLA、原 CSV 单位、shadow/健康/恢复边界说明准确。 | UDR-037-AC01 | 待补充：[README 契约](https://github.com/tianli-Backkom/union_monitor/blob/3889c8e4217db60bc3b5e5cde276f8cbd73c2d79/tests/test_readme_contract.py)、[设计检查](https://github.com/tianli-Backkom/union_monitor/blob/3889c8e4217db60bc3b5e5cde276f8cbd73c2d79/tests/test_unified_dashboard_design.py)日程配置联动。 |
| UDR-037-TC02 | 输入：干净 Python 3.12/Node 22 环境及受控线上 JSON/旧 HTML/离线 fixture；操作：按文档执行引导、启动和验证命令。 | 离线可初始化页面且验证退出零；默认同站 JSON；旧 HTML 仅显式兼容；错误输出可定位，命令不要求未说明的依赖/数据。 | UDR-037-AC02 | 待补充：[引导](https://github.com/tianli-Backkom/union_monitor/blob/3889c8e4217db60bc3b5e5cde276f8cbd73c2d79/tests/test_devdata.py)到干净环境文档命令 smoke；浏览器入口参考[基础测试](https://github.com/tianli-Backkom/union_monitor/blob/3889c8e4217db60bc3b5e5cde276f8cbd73c2d79/tests/browser/dashboard.spec.cjs)。 |

**验收条件：**

- [ ] UDR-037-AC01：新用户可直接找到入口、口径、当前运行/迁移与故障处理；不把未来能力写成已上线。
- [ ] UDR-037-AC02：支持运行时可按文档完成固定输入启动/验证；离线通过与今日来源采集/全量完整严格区分。

## 交付与证据

逐条记录AC→实际代码SHA→固定输入/来源指纹→操作或命令→预期/实际身份和数值→截图、实际下载或测试报告。文档/静态、模型、真实浏览器、来源对账和公开部署核验分别记录；缺证据标未验证。历史数字仅用于对应冻结输入，不作为每日阈值。

如需改代码，更新相关测试并创建对应Git commit；通过PR合入main。等待python-tests / frontend-tests / collector-contracts / workflow-lint及最终 **Dashboard quality gate** 全绿，保留required_status_checks与required_pull_request_reviews，不直推main或绕过保护；合并后删除临时分支。

## 来源与已有实现

- [2026-10-12-unified-dashboard-audit-requirements.md](https://github.com/tianli-Backkom/union_monitor/blob/3889c8e4217db60bc3b5e5cde276f8cbd73c2d79/docs/requirements/2026-10-12-unified-dashboard-audit-requirements.md)

已有实现参考（需逐AC验收，不能据此整项关闭）：[PR #2](https://github.com/tianli-Backkom/union_monitor/pull/2)


## 已建Issue待更新的两处目标正文

<a id="update-ec-010"></a>

### 更新 #27：[EC-010][P1] 修复散点图贴边并保障窄屏与键盘使用

<!-- union-monitor-requirements-20261022 key=EC-010 ids=EC-010,UAR-010,UAR-019,UDR-014 -->

关联总索引：[需求总索引 #17](https://github.com/tianli-Backkom/union_monitor/issues/17)

**优先级：** P1　**范围/状态：** 本期／待实施或待验收

**覆盖原编号：** EC-010、UAR-010、UAR-019、UDR-014

## 产品目标与范围

只保留能反映UBSCore / Triton-Ascend工程反馈速度、门禁稳定性和主要瓶颈的信息。导航仅两个社区、三种规范页；不恢复工作台、固定任务栏、独立数据质量/采集/指标说明页或高级分析面板。必要的截止、样本、排除与来源就地解释。

状态为待逐项核验；关联PR或历史台账不能替代当前代码业务验收。已有实现直接补验，有差距再改代码，避免重复开发；缺证据项保持未勾选。

## 详细需求、实施约束与固定输入

## 4. 交互与展示要求

左侧固定两个社区入口，选中态跟随当前社区；页面不再出现“任务”分组、工作台入口、页头项目下拉或同功能页签。UBS总览→仓库只需一次点击，Triton入口一次点击直达工作页，工作页再一次点击进入目标记录详情。

跨社区切换保留各自适用范围并写入目标URL；UBS始终先落总览，可从仓库表恢复该仓的上次范围。直接地址的显式参数优先，缺省参数取定义好的默认值，不能继承前一地址残留。浏览器前进后退恢复实际筛选、排序、页码及详情；关闭/Escape清详情参数并恢复焦点。搜索后列表计数/导出一致，KPI与趋势保持S。

页头用社区/仓库名承担标题，不再放“让每一次提交，清晰可见”大面积hero。1440px桌面首屏应看到范围、适用指标卡及诊断图标题；记录检索位于图下同页可达，提供一个“查看记录”页内锚点。手机单列排列，桌面图可并排；不为表格增加主导航。

两张图和导航器标签距容器裁切边至少8px，相邻标签间至少8px；支持320/390/768/1024/1440px与200%缩放。长耗时/跨日标签完整可读，必要时减刻度或换单位，不靠隐藏数据解决贴边。详情/记录均有键盘按钮；图中读数有可聚焦点或等价数据表，不只靠鼠标或颜色。

普通状态只占范围行的一条“数据截至…/采集于…”说明；只有迟更、部分覆盖或失败才显示紧邻内容的醒目提示。重读失败保留旧数据与原时间，不改成采集成功。提示不是新页面，不把整份运行报告、检查日志或采集计划搬入折叠面板。



## 可逐项核对的需求和验收清单

### EC-010：缩小页面而不牺牲读数和键盘路径（P1）

**需求：** 无大hero、无重复模块；两图/表格在窄屏和长标签下可用。

**验收标准：**
- [ ] EC-010-AC01：320/390/768/1024/1440px及200%缩放，所有图轴标签不裁切/重叠，边距及间隔均≥8px；无页面级横向溢出，宽表可在局部容器滚动且身份/详情按钮可达。
- [ ] EC-010-AC02：1440px首屏可见范围、适用的1～2卡及诊断图标题；键盘可切社区/范围、检索记录、打开关闭详情并回到触发点；图表数值有等价键盘读取路径。

**验证：** 真实截图与字体加载后边界测量、完整Tab/Enter/Escape路径；仅源码aria或旧截图不能作为验收。

### UAR-010：散点图时间/耗时刻度留白与可读性

**问题与影响：** E03与用户反馈。两张散点图使用固定边距，刻度长度随真实长耗时增加。既有时间轴首末锚点与刻度减量代码不能证明长纵轴标签及小屏仍有足够留白。

**需求要求：** E2E、NPU图和时间导航器依据实际字体与标签边界预留空间，统一上海时间格式；横轴日期时间、纵轴耗时/单位不得贴到容器或视口边缘、互相重叠或被裁切。必要时减少刻度、换行或提升单位，数值/映射不变；完整时间可在可聚焦详情读取。

**验收标准：**
- [ ] UAR-010-AC01：在1440/1024/768/390/320px、100%及200%缩放，使用E03长值和跨日窗口，两图与导航器所有可见标签在容器内，距容器裁切边至少8 CSS px，相邻标签边界至少8px，无页面级横向溢出。
- [ ] UAR-010-AC02：分别检查6/24/72小时、零/单点/长时长与窗口两端；缩放/换单位前后点的时间、数值、统计一致，截图与真实getBoundingClientRect边界检查均通过。

**测试设计：** 真实浏览器截图人工复核加文本边界断言；使用真实字体加载后的测量，不能仅测axisTicks返回数量。当前视觉状态为待验，不因历史REQ-031测试绿色关闭。

历史AC→当前验收映射（原文保留在来源文档；以下为按EC新范围调整后的验收，非历史原文）：

### UAR-019：键盘完成记录、执行与图表读取

**当前有效要求：** 记录提供可聚焦语义按钮，Enter/Space打开，Escape关闭并回焦点；图表有聚焦读数或等价表格。UBS新趋势按EC采用P50/P90，不为历史均值文字增加新的指标要求；原已有均值若保留也需可读。

**验收标准（按后续EC方案迁移）：**
- [ ] UAR-019-AC01：仅Tab/Enter/Space/Escape可进入两社区记录详情、切执行并回触发入口；来源外链独立可用，无焦点陷阱。
- [ ] UAR-019-AC02：键盘/读屏可读UBS每日期实际显示的P50/P90/n及单位、Triton各点身份/时间/结果/数值；保留的其他读数也可读，缩放后焦点可见，不仅鼠标hover。

**验证方式：** 真实键盘和可访问树验证，实际触发并核对身份/数值，不以aria源码存在代替。

### UDR-014：窄屏核心字段与完整键盘路径

**来源：** R09；产品 P-014；技术 T-014。
**优先级：** P2。
**需求描述：** 390×844、768px、1440px 保留项目/任务/范围/状态、记录身份、结果、时长与重载操作；只允许模块横滚，整页不横溢。键盘可完成项目选择、筛选、记录、详情与返回；状态不只靠颜色，重绘后焦点合理。

**自动化测试用例：**

| 用例 | 输入与操作 | 预期断言 | 关联验收 | 自动化覆盖 |
|---|---|---|---|---|
| UDR-014-TC01 | 输入：长标题/来源/多原因记录和三档视口；操作：打开各任务与全部批次，查看模块横滚。 | 结果和时长没有被 CSS 隐藏；关键控件可达；document.scrollWidth 不超过 innerWidth，长内容在模块内可访问。 | UDR-014-AC01 | 待补充：[Chromium 390px](https://github.com/tianli-Backkom/union_monitor/blob/3889c8e4217db60bc3b5e5cde276f8cbd73c2d79/tests/browser/dashboard.spec.cjs)至全部任务/三档宽度。 |
| UDR-014-TC02 | 输入：可交互记录/散点/三个 navigator slider，及 reduced-motion；操作：用 Tab、Enter/Space、Esc、方向键、Home/End 完成全路径与重绘。 | 行展开 ARIA 正确；预览/slider 值与焦点正确；无无法退出的焦点陷阱，modal 保留必要焦点约束且 Esc/关闭可退出；状态/通知可读。 | UDR-014-AC02 | 待补充：[可访问性](https://github.com/tianli-Backkom/union_monitor/blob/3889c8e4217db60bc3b5e5cde276f8cbd73c2d79/tests/accessibility.test.cjs)、[图表生命周期](https://github.com/tianli-Backkom/union_monitor/blob/3889c8e4217db60bc3b5e5cde276f8cbd73c2d79/tests/triton_lifecycle.test.cjs)与真实浏览器。 |

**验收条件：**

- [ ] UDR-014-AC01：各任务三档视口真实浏览器通过，核心诊断字段可见/可达，整页无横向溢出。
- [ ] UDR-014-AC02：键盘与鼠标具有等价操作，焦点与 ARIA 正确；仅 CSS/源码契约测试不算完整可访问验收。

## 交付与证据

逐条记录AC→实际代码SHA→固定输入/来源指纹→操作或命令→预期/实际身份和数值→截图、实际下载或测试报告。文档/静态、模型、真实浏览器、来源对账和公开部署核验分别记录；缺证据标未验证。历史数字仅用于对应冻结输入，不作为每日阈值。

如需改代码，更新相关测试并创建对应Git commit；通过PR合入main。等待python-tests / frontend-tests / collector-contracts / workflow-lint及最终 **Dashboard quality gate** 全绿，保留required_status_checks与required_pull_request_reviews，不直推main或绕过保护；合并后删除临时分支。

## 来源与已有实现

- [2026-10-21-engineering-capability-dashboard.md](https://github.com/tianli-Backkom/union_monitor/blob/3889c8e4217db60bc3b5e5cde276f8cbd73c2d79/docs/requirements/2026-10-21-engineering-capability-dashboard.md)
- [2026-10-21-dashboard-user-audit.md](https://github.com/tianli-Backkom/union_monitor/blob/3889c8e4217db60bc3b5e5cde276f8cbd73c2d79/docs/requirements/2026-10-21-dashboard-user-audit.md)
- [2026-10-12-unified-dashboard-audit-requirements.md](https://github.com/tianli-Backkom/union_monitor/blob/3889c8e4217db60bc3b5e5cde276f8cbd73c2d79/docs/requirements/2026-10-12-unified-dashboard-audit-requirements.md)

已有实现参考（需逐AC验收，不能据此整项关闭）：[PR #16](https://github.com/tianli-Backkom/union_monitor/pull/16)


---

<a id="update-psg-005"></a>

### 更新 #34：[PSG-005][P1] 保护全旅程运行错误、双社区读取失败与恢复

<!-- union-monitor-requirements-20261022 key=PSG-005 ids=PSG-005,UAR-016,UDR-013 -->

关联总索引：[需求总索引 #17](https://github.com/tianli-Backkom/union_monitor/issues/17)

**优先级：** P1　**范围/状态：** 本期／待实施或待验收

**覆盖原编号：** PSG-005、UAR-016、UDR-013

## 产品目标与范围

只保留能反映UBSCore / Triton-Ascend工程反馈速度、门禁稳定性和主要瓶颈的信息。导航仅两个社区、三种规范页；不恢复工作台、固定任务栏、独立数据质量/采集/指标说明页或高级分析面板。必要的截止、样本、排除与来源就地解释。

状态为待逐项核验；关联PR或历史台账不能替代当前代码业务验收。已有实现直接补验，有差距再改代码，避免重复开发；缺证据项保持未勾选。

## 详细需求、实施约束与固定输入

## 4. 必需页面旅程与门禁执行约束

保留现有四job和最终必需检查名。frontend-tests执行完整既有浏览器套件，并把下列BASIC用例纳入必需集合；不因为40这个历史数量固定总测试数。清单明确列ID/用例名，JUnit检查这些用例均存在、实际执行、无失败/跳过；不能根据当前发现到的测试自动缩小必需清单。

| ID | 固定输入/操作 | 必须断言的用户结果 | 复用或新增位置 |
|---|---|---|---|
| BASIC-001 | UBS总览、UBS单仓、Triton规范入口冷启动 | 正确标题/社区/真实非空数据身份；控件可操作；无非预期脚本/资源错误 | dashboard、unified-navigation |
| BASIC-002 | 总览点仓→Triton→UBS→前进/后退，含旧链接 | 社区、仓、活动导航、规范地址对应；旧详情释放，无空白/占位旧任务 | unified-navigation、url-context |
| BASIC-003 | 第6节相反时钟样本，原生select选submitted；切换各PR/批次排序 | 文案/value/实际全页行ID/显示时间正确，非只断言控件选中 | 新ubs-submission-sort.spec.cjs＋unified-records |
| BASIC-004 | ≥31 PR，分别15/30/50遍历每一页 | 精确全集顺序、唯一ID、首末页、按钮和重置正确，关键路径不条件skip | unified-records |
| BASIC-005 | 独立编号/标题/作者/SHA/no-match，清除与当前PR状态筛选 | 精确命中ID/count；no-match数据行0＋空态；搜索不改分析KPI；状态筛选按其明确语义计算 | advanced-sample-filter |
| BASIC-006 | 多执行PR、非代表批次、无代表、异仓同号 | PR唯一、最长代表不变；详情打开实际选中身份与任务；全部已采集执行可查 | unified-detail |
| BASIC-007 | 打开详情、Escape/关闭、刷新、Back/Forward | dialog、pr/batch参数及实际内容同步；回焦点，筛选/排序/页码不丢 | unified-detail、url-context |
| BASIC-008 | Triton分支/共享选窗、图点定位、时间未知；UBS任务排队/执行切换 | 每图按自身资格从同一S派生；有效n/读数可核对；选择实际改变范围/读数；未知时间不混统计 | dashboard＋指标受控fixture |
| BASIC-009 | UBS/Triton分别首读503/坏JSON/超时及成功后重读失败，再恢复 | 首读不报零成功；旧身份/截止保留，错误明确、reload恢复；另一社区可用 | 新basic-load-recovery.spec.cjs |
| BASIC-010 | 搜索＋跨页＋submitted排序，实际下载CSV及选中执行任务 | 下载ID、顺序、全量L、毫秒/秒单位、提交时间来源正确；不只看行数 | unified-export、unified-detail |
| BASIC-011 | 320/390/768/1024/1440及长时间轴 | 关键身份/结果/时间/详情按钮可达，无页面横溢；图标签边界不裁切/重叠 | dashboard布局用例增强 |
| BASIC-012 | 纯键盘进入社区、检索/排序、打开记录/图点详情、退出 | 按Enter/Space实际触发，Escape后焦点/URL恢复，无焦点陷阱 | 新basic-keyboard.spec.cjs或复用detail |

PR状态生命周期分析筛选与“失败/执行中”等记录定位不是同一条件：门禁必须逐一说明S/L预期。本期提交时间排序不得借机改变现有分析范围；若与既有EC展示方案待落地部分冲突，单列差异，不用同一测试对两个含义互相背书。

测试输入必须固定、可离线构造、与预期排序独立。禁止用生产sort函数生成预期再与自身比较；不得依赖当天线上PR数或源站可用性。新增公共浏览器fixture在整个旅程收集pageerror、console.error、关键同源JS/CSS/JSON加载失败；故障用例只对明确URL/状态/消息做局部预期放行，不全局吞错。

CI设置forbidOnly=true并保留0 retry；关键用例禁止skip/fixme。YAML结构测试要验证四job、精确needs/always、真实Node/浏览器执行步骤、没有continue-on-error或条件绕过，并追踪package.json中test:browser仍执行完整套件而非仅list/单文件；不能只靠命令文字出现在注释里。basic清单核验、JUnit、trace/截图保留在现有frontend-tests内，失败导致该job失败。JUnit须由本轮清理旧产物后新生并绑定当前代码/run，不得沿用旧报告冒充本轮实际执行。



## 可逐项核对的需求和验收清单

### PSG-005：全旅程运行错误与故障恢复受保护（P1）
**需求：** 公共fixture捕获意外运行错误/关键资源失败，补双社区首读和重读故障。

- [ ] PSG-005-AC01：任意基本旅程出现未声明的pageerror、console.error、关键JS/CSS/JSON失败都失败；故意注入503只放行指定预期，其他错误仍被拦。
- [ ] PSG-005-AC02：两社区首读失败、旧数据重读失败、恢复、空集合/坏窗口均有不同可见状态；另一社区继续操作，reload不永久禁用，原数据身份与时间不被伪更新。

**验证：** 受控网络拦截与结果身份比较；不重跑生产采集制造故障。

历史AC→当前验收映射（原文保留在来源文档；以下为按EC新范围调整后的验收，非历史原文）：

### UAR-016：现存页面统一读取失败、旧数据和恢复状态

**当前有效要求：** UBS总览/单仓工程效能与Triton工程效能共用所属数据的读取/有效性状态；工作台及拆分趋势/记录页面已退役。保留原采集/截止、最近失败与重试入口，社区故障隔离。

**验收标准（按后续EC方案迁移）：**
- [ ] UAR-016-AC01：先成功载入Triton再重读失败，在现存入口/记录区/详情始终显示同一旧快照与失败提示，不改collected_at，不清成暂无数据。
- [ ] UAR-016-AC02：首读503/超时/无效JSON、单仓失败和恢复分别有真实状态；恢复清错误、可再重读；另一社区仍可筛选/下钻。

**验证方式：** 真实浏览器受控拦截双社区首次和重读，对照实际身份/时间及reload恢复，不重新挂载退役页面。

### UDR-013：完整读取超时、并发防护与失败保留

**来源：** R09；产品 P-013。
**优先级：** P1。
**需求描述：** 30 秒超时覆盖 fetch、响应体与 JSON 解析全过程，并中止请求和恢复操作。HTTP/格式/归属错误保留同归属有效旧快照；一个项目失败不清空其他项目；后发请求优先，旧响应不能覆写新状态或进入新聚合。

**自动化测试用例：**

| 用例 | 输入与操作 | 预期断言 | 关联验收 | 自动化覆盖 |
|---|---|---|---|---|
| UDR-013-TC01 | 输入：响应头成功但 json 永久挂起；操作：用固定计时触发 30 秒超时再重读。 | 请求 abort，提示完整读取超时，loading 结束且按钮可再次使用；不只验证响应头。 | UDR-013-AC01 | 待补充：[实际 JSON 超时](https://github.com/tianli-Backkom/union_monitor/blob/3889c8e4217db60bc3b5e5cde276f8cbd73c2d79/tests/app_runtime.test.cjs)已有 abort 基础，补 loading/再次重读及浏览器响应体故障流。 |
| UDR-013-TC02 | 输入：有效旧快照后 503/坏 JSON/错仓库；另有 A/B 请求且 B 先结束；操作：重载并等待真实错误状态。 | 保留旧快照供重新下钻并解释失败，已打开详情按 UDR-012 清理；其他项目可更新；A 后返不覆盖 B，失败新仓不混入新范围聚合。 | UDR-013-AC02 | 待补充：[重载运行](https://github.com/tianli-Backkom/union_monitor/blob/3889c8e4217db60bc3b5e5cde276f8cbd73c2d79/tests/app_runtime.test.cjs)、[浏览器 503](https://github.com/tianli-Backkom/union_monitor/blob/3889c8e4217db60bc3b5e5cde276f8cbd73c2d79/tests/browser/dashboard.spec.cjs)完整参数矩阵。 |

**验收条件：**

- [ ] UDR-013-AC01：无无限等待/永久 loading，所有完整读取路径能成功、失败或中止并恢复操作。
- [ ] UDR-013-AC02：故障与乱序不串写，不伪造新数据；浏览器测试等待真实 503 提示，不能匹配页面原有“失败批次”文字代替。

## 交付与证据

逐条记录AC→实际代码SHA→固定输入/来源指纹→操作或命令→预期/实际身份和数值→截图、实际下载或测试报告。文档/静态、模型、真实浏览器、来源对账和公开部署核验分别记录；缺证据标未验证。历史数字仅用于对应冻结输入，不作为每日阈值。

如需改代码，更新相关测试并创建对应Git commit；通过PR合入main。等待python-tests / frontend-tests / collector-contracts / workflow-lint及最终 **Dashboard quality gate** 全绿，保留required_status_checks与required_pull_request_reviews，不直推main或绕过保护；合并后删除临时分支。

## 来源与已有实现

- 原始方案：`docs/requirements/2026-10-22-pr-submission-sort-and-quality-gate.md`，本地规格提交`3096c69`；尚未合入main，相关完整契约已内嵌正文，不依赖未发布文件。
- [2026-10-21-dashboard-user-audit.md](https://github.com/tianli-Backkom/union_monitor/blob/3889c8e4217db60bc3b5e5cde276f8cbd73c2d79/docs/requirements/2026-10-21-dashboard-user-audit.md)
- [2026-10-12-unified-dashboard-audit-requirements.md](https://github.com/tianli-Backkom/union_monitor/blob/3889c8e4217db60bc3b5e5cde276f8cbd73c2d79/docs/requirements/2026-10-12-unified-dashboard-audit-requirements.md)
