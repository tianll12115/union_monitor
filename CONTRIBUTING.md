# 贡献指南

本文件说明开发环境、PR 提交流程与 CI 门禁。运行入口见 [README](README.md)，文档导航见 [docs/README.md](docs/README.md)。

## 环境准备

CI 使用 Python 3.12、Node 22；依赖以 `package-lock.json` 为准，统一使用 npm。Python 运行代码仅依赖标准库，开发检查使用 PyYAML、coverage.py 与 c8：

```sh
python -m pip install -r requirements-dev.txt
npm ci --ignore-scripts
npx playwright install --with-deps chromium
```

Linux / WSL 与 CI 最接近；Windows 可运行同一入口（Node 测试文件由脚本枚举，无需依赖 shell 展开通配符）。PowerShell 环境变量写法为 `$env:PYTHON='python'`。

## 本地验证

```sh
python -B scripts/run_checks.py            # 完整 Python / Node UT 和新增行覆盖率检查
python -B scripts/run_checks.py --browser  # 追加完整 Chromium、12 个 BASIC 与 4 个 Triton 散点旅程核验
```

`--browser` 会把固定 fixture 写到 `data/`、`web/data/`，请在独立开发副本执行，勿在生产采集目录执行。

## 提交 PR

> 创建 PR 前必须执行全量 UT、浏览器交互和新增行覆盖率检查；任何步骤失败都会停止，不使用历史通过报告。

```sh
git switch -c codex/your-change
git config core.hooksPath .githooks
# 改动、补充相关测试后：
git add <明确的文件>
git commit -m "描述改动"
python -B scripts/submit_pr.py --title "描述改动" --body-file /path/to/pr-body.md
```

PR 正文文件请放在工作区外或 `.tmp/` 内，避免成为未跟踪文件。`submit_pr.py` 要求干净工作区及功能分支，重新运行 UT、复查工作区，再推送当前分支并调用已登录的 GitHub CLI 创建 PR；`--remote NAME` 可指定目标 remote，默认 `origin`。

安装的 pre-push hook 和 `submit_pr.py` 强制执行 `--browser`：要求干净工作区、待推 SHA 等于当前 HEAD，并拒绝直接推送 main；测试后复查 SHA、分支和工作区。hook 是本地约定，GitHub 网页 / API 可以绕过；服务端必须同时启用分支保护。

覆盖率检查读取本次全量 UT 生成的 Python/Node LCOV，按 `git diff --merge-base main` 的新增及修改行计算，生产代码的可执行行覆盖率必须严格大于 80%；缺失测量文件直接失败。报告位于 `test-results/changed-coverage.json`。CI 使用当前 PR 的 base SHA，保留现有全量 UT 命令，并在 `frontend-tests` 强制执行相同检查。浏览器测试必须断言实际可见的批次身份、数值和来源链接；仅验证弹窗存在不足以验收。

## 服务端门禁

[`.github/workflows/pr-gate.yml`](.github/workflows/pr-gate.yml) 对所有指向 main 的 PR、merge queue、main 更新及手动运行执行以下检查，不按修改路径跳过：

| 检查 | 验证内容 |
|---|---|
| python-tests | 全量 Python 回归、YAML 结构与故障注入 |
| frontend-tests | 全量 Node、Chromium、BASIC/Triton 必跑清单与新增行覆盖率 >80% |
| collector-contracts | UBS/Triton 适配器、缓存、隔离与部署验证契约 |
| workflow-lint | 固定版本及 SHA256 的 actionlint |
| Dashboard quality gate | 四项必须全部 success；失败、取消、跳过或缺项均拒绝 |

main 保护规则：必须通过 PR，无需人工批准（批准数为 0，不要求最后一次推送批准或 Code Owner 批准），不强制解决审查讨论；要求当前提交的 `Dashboard quality gate` 成功并在合入前更新分支、消除合并冲突；管理员同样遵守；禁止强推和删除。满足条件即可直接合入，目标配置见 [main-protection.json](.github/main-protection.json)。PR 合并后删除远端和本地临时分支。

## 文档与文件维护

- 新增行为必须补充测试；每组完成的改动必须创建 Git commit。
- `audit/` 中冻结证据和规格仍被测试引用，不能作为普通日志批量删除。
- `data/`、`web/data/`、`web/exports/`、`test-results/`、`.tmp/`、本地采集日志和依赖目录不提交。
- 修改工作流后运行 actionlint；PR 检查成功只证明代码门禁，不能代替真实采集及部署验证。
