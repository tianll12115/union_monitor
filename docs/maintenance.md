# 项目维护与仓库迁移

## 2026-10-23 整理范围与实施顺序

目标仓库：`https://github.com/tianll12115/union_monitor.git`。保留既有代码与 commit 历史；项目代码通过功能分支和 PR 引入。

1. 检查引用和基线测试，删除与 npm 工作流重复的 `pnpm-lock.yaml`。
2. 保留被契约测试、验收台账引用的历史证据；忽略 `.tmp/` 和根目录临时采集日志，保留未提交现场文件。
3. 补充文档索引、贡献指南、PR 模板、统一 UT 入口和 pre-push hook；测试失败时阻止推送与创建 PR。
4. 运行 Python、Node、Chromium、BASIC 核验及 actionlint；每组完成的变更创建 commit。
5. 向指定仓库提交 PR，实际执行 Actions 并核对最终 SHA；服务端设置 main 必需门禁与 PR 审查后才能合入。

采用现有四项门禁加汇总检查，避免引入第二套互相漂移的 CI。历史审计文件有可核查引用，无法仅凭日期判定废弃，因此本轮保留。

## 迁移约束

新仓库初始化时为空，需先有只包含说明文件的 main 基线才能创建 PR。完整项目禁止直推 main。旧公开站点仍作为历史已发布站点记录；新站点部署通过前不能声称新地址可用。

GitHub 连接器和原有本地 Git 凭据返回账户 suspended 的 403；Chrome 中目标仓库的所有者会话可访问。浏览器登录不等于命令行 Git 已切换账户。凭据仅通过 GitHub / Git Credential Manager 的正常登录流程处理，不写入仓库或报告。

已通过 Git Credential Manager 以 `tianll12115` 身份推送功能分支。新仓库原先没有 main 保护；现已启用必需 `Dashboard quality gate`、严格分支更新、至少一次批准、最后一次推送审查、过期批准失效、管理员遵守保护、禁止强推/删除，并启用合入后自动删除远端功能分支。新仓库 main 初始化 commit 为 `8abc962`；本地通过 merge 关联初始化历史，完整项目仍由 PR 引入。

生产迁移修复：Triton token 可回退到本次工作流 token；每日流程仅 main 部署；健康检查使用当前仓库站点，避免新仓库误检查旧站。历史快照恢复地址保留为旧站，允许冷启动迁移；它通过现有校验才可使用，失败不会发布伪造数据。

## 验证记录

基线在 WSL Ubuntu / Python 3.12.3 执行 922 项 Python 测试通过；1 项因未生成本地 Triton 工件跳过。离线 UT 不证明线上来源完整；真实采集、Pages 发布及新仓库保护配置必须有独立运行证据。

最终验证结果在对应 Git commit / PR 的说明中记录；未经实际执行的 Actions 不标记成功。

第一轮整理后验证：Python 932 项通过（1 项缺本地 Triton 生产工件跳过）、全量 Node 通过、Chromium 47/47、BASIC 12/12、actionlint 通过。
