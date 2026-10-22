# UBSCore 提交时间排序与 PR 页面基本功能门禁方案

日期：2026-10-22（上海时间）。审查基线：`3889c8e4217db60bc3b5e5cde276f8cbd73c2d79`。本次交付需求、审查证据与规格测试，不修改产品排序或工作流；业务验收均为待实施/待验证。文档校验通过不等于业务实现通过。

## 1. 已确认的需求与决策

用户明确选择：**提交时间＝PR最近一次代码提交／推送时间，排除重跑**。因此不能只把“创建时间从新到旧”换一个名字，也不能按最近一次Jenkins触发、PR更新时间或Git作者时间排序。

推荐采用“统一派生提交时间＋真实浏览器行为门禁”：在现有create/push事件上派生时间，列表显示、排序、URL、CSV共用语义；模型/独立复算负责边界，浏览器负责原生控件、事件接线和实际行序。仅改文案不能满足需求；新建提交采集系统没有必要，现有来源事件可复用。

默认“代表E2E从长到短”和“一PR一行、最长合格代表”继续保留。本次替换的是时间排序选项；与时间有关的并列规则统一采用最近提交时间，避免列表显示提交时间、并列却暗用创建时间。PR创建时间仍保留在详情、旧CSV和原有创建队列分析范围中；**本次不把UBS时间窗和趋势横轴改成提交时间**。

门禁目标是保护基本用户任务：页面能打开、导航能进入正确社区/仓、列表能搜索排序分页、详情与地址正确、图表与范围可用、下载内容正确、故障后可恢复、窄屏和键盘主路径可达。一次绿色不证明线上来源完整，也不能承诺以后绝无缺陷。

## 2. 当前实现与门禁审查结论

### 2.1 时间链路

| 位置 | 当前事实 | 本期改动要求 |
|---|---|---|
| [事件提取](../../metrics.py) `extract_events` | create来自PR.created_at；push来自操作日志created_at；评论命令是retest | 只把权威create/push作为代码提交候选，重跑/评论永不更新时间 |
| [采集装配](../../collect.py) `one_pr` | 事件先按end_ms截断，独立保存events；PR目前只有created_ms等时间 | 新快照显式提供提交时间、来源和事件采集状态；未关联门禁的push仍有效 |
| [PR模型](../../web/core.js) `sortPRs` | created主排序和E2E/批次数并列均使用created_ms | 增加submitted键与统一时间谓词，更新独立复算 |
| [列表接线](../../web/app.js)、[模板](../../web/index.html) | 选项/行说明仍叫创建时间，行内显示日期级created_ms | 选项、行时间、表头、排序说明与实际比较器一致，时间精确到秒 |
| [排序验证](../../scripts/verify_ubs_sorting.py)、[测试](../../tests/test_ubs_sorting.py) | Python独立谓词与真实core.js交叉核对，已保护旧created规则 | 更新为新语义，保留独立预期与负向用例，不能删旧断言了事 |

时间证据见[提交语义审查](../../audit/2026-10-22/pr-submission-gate-review/submission-time-evidence.json)。其中本地历史快照不是今天线上全集，不使用其PR数量评价今日完整性。

### 2.2 门禁已有保护与明确缺口

现有[PR工作流](../../.github/workflows/pr-gate.yml)对main的PR、merge_group、main push和手动运行执行四项：python-tests、frontend-tests、collector-contracts、workflow-lint。frontend-tests确实运行确定性离线数据、Node与真实Chromium；没有路径排除、PR生产采集或部署。最终`Dashboard quality gate`使用always汇总；[ci_gate.py](../../scripts/ci_gate.py)要求四项恰好存在且全部success，其余状态失败关闭。这些保护保留，不另造一个可选门禁。

本次实际执行：Node **271/271**，浏览器 **40/40、0 skipped**，聚合契约 **5/5**、旧排序验证 **16/16**通过。浏览器8个文件涵盖导航、列表、详情、导出、URL、错误恢复和布局。**当前绿色仍没有验证新提交排序。** 远端分支保护是否实际绑定当前检查需在发布验收读回，本轮未据本地YAML推断远端配置已验证。

| 编号 | 已有保护 | 证据支持的缺口/风险 | 对策 |
|---|---|---|---|
| A01 | 旧created/E2E/批次数有模型与独立重算 | 浏览器只恢复sort=batches控件，没有断言实际排序行ID；尚无push/retest时钟相反样本 | 新语义独立oracle＋原生select操作后精确行序 |
| A02 | 15/30/50页长和范围文字已测 | 未在浏览器翻完全部页收集ID；样本≤15时关键分页用例会skip | 固定≥31条基本样本，全页无重/无漏且必执行 |
| A03 | Triton零搜索结果已有行数/KPI断言 | UBS无匹配搜索只断言tbody非空；空态行和未过滤全量行都能通过 | 断言数据行ID、0 count、空态及KPI不变 |
| A04 | 多数详情/下载/历史路径已测 | 部分只验证可见性、数量或控件值，未贯通选中身份、顺序和导出内容 | 身份级预期贯穿列表→详情→下载→返回 |
| A05 | 初始化部分入口监听pageerror；Triton503有回退用例 | 无全旅程统一错误/关键资源失败检查，UBS首次失败/重载故障矩阵不齐 | 公共浏览器fixture收集非预期错误，明确放行注入故障 |
| A06 | 0 retry、失败trace/screenshot/JUnit已配置 | 未设置CI forbidOnly；关键测试缺失/跳过不一定导致失败 | 禁only，显式关键用例清单与JUnit实际执行核对 |
| A07 | 聚合器严格检查job结果 | job成功不证明浏览器步骤存在；只读内存将npm run test:browser换成echo，现有工作流文本契约仍通过 | YAML结构校验真正的执行步骤/needs/条件，添加移除步骤负向测试 |
| A08 | 390px字段及五宽度页面溢出已测 | 无页面溢出不等于轴文字可读；键盘Escape隐藏不等于URL/焦点正确 | 保留现有用例并补标签边界、键盘返回与URL身份 |

[门禁审查证据](../../audit/2026-10-22/pr-submission-gate-review/gate-coverage-evidence.json)记录路径、行号、方法和结果。A07是未来防回归缺口，**不是当前工作流省略了浏览器执行**。VM harness在真实事件绑定前截断、DOM替身不能模拟原生select有效值，因此静态/VM绿色不替代浏览器行为。

## 3. 提交时间的数据与排序契约

### 3.1 定义、边界和旧数据

候选仅为同一完整PR身份下的已识别create/push事件：create来源PR.created_at，push来源operate_logs.created_at。取截止点以内合法time_ms的最大值。多commit的一次push按该次平台推送事件时间；强推若被源平台确认为push也纳入。无需batch_urls、E2E资格、成功结果或单个sha才纳入；未跑门禁的代码推送也算提交。

不使用retest、note、普通评论、合入/关闭、updated_at、Git author/committer、webhook/jobTriggerTime、Jenkins start/end、采集/页面读取时间。时间戳为安全整数毫秒且非负，0合法；null、布尔、字符串、负值、非有限值或晚于快照end_ms的事件不参与并暴露异常，不能用当前时间填充。

新增可加性字段：

| 字段 | 语义 |
|---|---|
| latest_submission_ms | 当前快照证据允许参与排序的最近提交时间，未知为null |
| latest_submission_event_id / latest_submission_source | 选中事件ID和PR.created_at / operate_logs来源，不能只留一个无法解释的日期 |
| submission_events_status | complete / partial / unknown；complete只表示本次来源事件采集完成，不等于独立证明平台所有历史完整 |
| submission_time_origin | collected / legacy-observed；区分新采集契约与旧快照事件派生，不把legacy-observed冒充complete |
| latest_observed_submission_ms | 事件采集partial时仍保留已观测下界，供详情解释；不冒充最新值排序 |
| submission_time_profile | `ubs-latest-code-submission-v1`；旧schema不冒充已经提供新字段 |

新采集完整且没有push时，create本身就是首次代码提交到PR的时间。操作日志请求/分页失败或未能识别应识别的commit操作时，标partial、latest_submission_ms=null，详情给观测时间和原因；单纯评论采集失败不应抹掉完整代码事件时间。

旧快照没有新字段时，前端按同一算法读取原始events：有权威有效create/push、没有已报告的代码事件采集失败，可派生为`legacy-observed`并提示“按已采集事件”；legacy-observed是submission_time_origin的值，不是submission_events_status的第四种值，也不是平台完整性承诺。只有created_ms、无events/完整性证据，或明确存在操作日志采集失败时，不把created_ms伪称最近提交，排序值未知；详情可显示首次创建及已观测下界。新派生字段与原events矛盾须报不一致，不盲信过期缓存。

legacy-observed记录的submission_events_status为unknown（未提供本轮完整性字段），仍允许其权威events最大观测值按已采集语义排序；这项兼容仅适用于旧格式且无已报告日志失败。新格式unknown/partial则不提供已确认排序值，必须带原因和观测下界，不利用兼容分支绕过新契约。

### 3.2 页面、排序与兼容

- 选项固定显示“提交时间从新到旧”，value为`submitted`；PR表头为“PR / 提交时间”，行内显示上海`YYYY-MM-DD HH:mm:ss`和来源提示，详情同时区分创建、最近代码提交和执行触发时间。未知显示“提交时间未确认”，不能显示1970年或跳到第一位。
- submitted全量降序，未知最后；同提交时间按PR编号数值降序，再按完整源/仓/PR身份稳定决胜，不依赖输入顺序。先排序后分页，15/30/50切换无重复遗漏，改变排序回第1页。
- 代表E2E、批次数仍为原主键，主值并列再按相同提交时间谓词和稳定身份决胜。不得因改排序改变代表批次、KPI/趋势、时间选区或执行历史。
- 新URL输出`sort=submitted`，冷启动/刷新/分享/同页实体切换/前进后退恢复实际行序；旧`sort=created`作为迁移别名规范化为submitted，并简短说明排序口径已升级。不能继续输出旧键或静默回默认E2E。批次实体保留duration/start/queue，不把PR提交时间偷换成批次开始时间。
- 旧CSV保留“创建时间”原字段，在末尾添加最近提交时间、毫秒值、事件来源及资格状态，元信息含排序键/方向/profile；下载遵循完整未分页列表顺序。未知留空，旧列不更名冒充新时间。

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

## 5. 可实施需求与验收标准

### PSG-001：提交时间派生可追溯（P1）
**需求：** 实现第3节来源、截止、资格和新旧快照兼容。

- PSG-001-AC01：第6节样本独立复算为104、103、102、101、105；101的最新重跑不更新08:30推送时间，103无门禁的push仍算，105未知置末。
- PSG-001-AC02：完整无push取create；明确partial、只有created无events、future/非法/零值各有固定断言；新Python派生与旧快照前端派生同义，不能借用updated/Jenkins时间。

**验证：** metrics.py/collector契约、真实core.js、Python独立oracle，故意把retest纳入或用created比较时必须红。

### PSG-002：列表时间与全量排序一致（P1）
**需求：** 新选项、行时间、主排序/并列、分页与其他指标语义一致。

- PSG-002-AC01：原生select选submitted后，首屏和所有页拼接实际ID符合独立预期，时间精确到秒；同值稳定、0有效、未知末置；页长和输入乱序不改变集合。
- PSG-002-AC02：E2E/批次数主值不变、并列按提交时间；#1627仍一PR一行、代表#7604、997459ms、9执行/45任务；排序/重跑不改KPI、创建时间窗或趋势横轴。

**验证：** 更新verify_ubs_sorting及旧created断言，补真实浏览器行序而非仅源码文案。

### PSG-003：分享、返回和导出使用新时间（P1）
**需求：** submitted键完整往返；旧created有可解释迁移；CSV增加字段不破坏旧列。

- PSG-003-AC01：新页/刷新/前进后退/PR与批次切换后控件与实际序列相同；旧sort=created迁移submitted并说明，不能仅控件正确而列表仍E2E。
- PSG-003-AC02：搜索后跨页导出实际ID/顺序等于完整L，创建时间与提交时间分别保留；partial/unknown无伪新时间，0不被导出为空。

**验证：** URL上下文与实际下载解析，精确比较字段和值。

### PSG-004：基本旅程成为必需执行集合（P1）
**需求：** BASIC-001～012全数登记并在PR门禁实际执行。

- PSG-004-AC01：本轮新生且绑定当前代码/run的JUnit显示12个必需ID均执行且无失败/跳过；旧报告、发现0用例、漏ID、关键skip/fixme或.only均使frontend-tests失败；当前40用例保留有效覆盖，不以固定总数替代旅程核验。
- PSG-004-AC02：分页样本≥31且遍历完整序列；UBS no-match精确数据行0、导出精确身份、URL检查实际内容。基本动作无效时，即使页面标题仍在也应失败。

**验证：** 完整Chromium套件、关键清单核验及删除/跳过/only故障注入。

### PSG-005：全旅程运行错误与故障恢复受保护（P1）
**需求：** 公共fixture捕获意外运行错误/关键资源失败，补双社区首读和重读故障。

- PSG-005-AC01：任意基本旅程出现未声明的pageerror、console.error、关键JS/CSS/JSON失败都失败；故意注入503只放行指定预期，其他错误仍被拦。
- PSG-005-AC02：两社区首读失败、旧数据重读失败、恢复、空集合/坏窗口均有不同可见状态；另一社区继续操作，reload不永久禁用，原数据身份与时间不被伪更新。

**验证：** 受控网络拦截与结果身份比较；不重跑生产采集制造故障。

### PSG-006：四门禁执行结构与最终汇总不可假绿（P1）
**需求：** 保留四job及Dashboard quality gate，同时约束实际执行步骤和聚合异常。

- PSG-006-AC01：删除/echo替换浏览器步骤、将package.json脚本改为仅list/单文件、移除清单核验、减少needs、加continue-on-error/条件绕过的YAML/脚本变体均被结构契约拒绝。
- PSG-006-AC02：四job逐个注入failure/cancelled/skipped/missing或坏JSON，最终非零；全部真实检查success才允许通过。远端读回required_status_checks和required_pull_request_reviews仍保留，main不可直推。

**验证：** YAML解析的变异用例、ci_gate真实CLI、受控测试分支当前commit检查；本地文件不替代远端策略证据。

### PSG-007：用故障反证门禁有效并闭环交付（P1）
**需求：** 基本用例不仅绿，还要证明能拦对应破坏；证据绑定提交与输入。

- PSG-007-AC01：第7节每项受控故障至少被一个正确命名的用例拦住，失败原因是行为断言而非测试环境没启动；恢复后全套绿，不在生产或main故意制造故障。
- PSG-007-AC02：交付记录代码SHA、fixture指纹、用例清单、实际pass/fail/skip、JUnit/trace/故障差异与恢复结果。文档结构、模型、浏览器、CI和远端保护分别记录，缺证据标未验证。

**验证：** 隔离临时checkout/工作树逐一注入并恢复，不用降低断言、增加无依据重试或删除保护转绿。

## 6. 固定相反时钟样本

以下时间为上海2026-10-22，create可早于当天；cutoff为09:00。101～104是旧events按legacy-observed解释的受控语义样本，不是缺少status的新采集协议样例；105未知，partial/非法/0值另由独立用例覆盖。为了使“只改文案”必失败，创建顺序与代码推送顺序故意相反。另用0/1/15/16/30/31总数和15/30/50页长做生成型分页边界，主浏览器基本样本至少31条。

```json
{
  "status": "specification_not_implemented",
  "fixture_origin": "legacy-observed-events",
  "time_profile": "ubs-latest-code-submission-v1",
  "sort_key": "submitted",
  "legacy_sort_alias": "created",
  "cutoff": "2026-10-22T09:00:00+08:00",
  "exclude_event_kinds": ["retest", "note", "comment"],
  "cases": [
    {"pr": 101, "created": "2026-10-20T08:00:00+08:00", "events": [
      {"id": "c101", "kind": "create", "source": "PR.created_at", "at": "2026-10-20T08:00:00+08:00"},
      {"id": "p101", "kind": "push", "source": "operate_logs", "at": "2026-10-22T08:30:00+08:00"},
      {"id": "r101", "kind": "retest", "source": "comments", "at": "2026-10-22T08:59:00+08:00"}
    ]},
    {"pr": 102, "created": "2026-10-22T08:45:00+08:00", "events": [
      {"id": "c102", "kind": "create", "source": "PR.created_at", "at": "2026-10-22T08:45:00+08:00"}
    ]},
    {"pr": 103, "created": "2026-10-19T08:00:00+08:00", "events": [
      {"id": "c103", "kind": "create", "source": "PR.created_at", "at": "2026-10-19T08:00:00+08:00"},
      {"id": "p103", "kind": "push", "source": "operate_logs", "at": "2026-10-22T08:55:00+08:00", "batch_urls": []}
    ]},
    {"pr": 104, "created": "2026-10-18T08:00:00+08:00", "events": [
      {"id": "c104", "kind": "create", "source": "PR.created_at", "at": "2026-10-18T08:00:00+08:00"},
      {"id": "p104", "kind": "push", "source": "operate_logs", "at": "2026-10-22T08:55:00+08:00"}
    ]},
    {"pr": 105, "created": null, "events": []}
  ],
  "expected_order": [104, 103, 102, 101, 105],
  "expected_created_order": [102, 101, 103, 104, 105],
  "required_basic_ids": ["BASIC-001", "BASIC-002", "BASIC-003", "BASIC-004", "BASIC-005", "BASIC-006", "BASIC-007", "BASIC-008", "BASIC-009", "BASIC-010", "BASIC-011", "BASIC-012"],
  "required_jobs": ["python-tests", "frontend-tests", "collector-contracts", "workflow-lint"]
}
```

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
