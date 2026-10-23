# 开发与提交

## 环境与验证

CI 使用 Python 3.12、Node 22；依赖以 `package-lock.json` 为准，统一使用 npm。
Python 运行代码只使用标准库，测试的 YAML 契约检查另需 PyYAML：

```sh
python -m pip install -r requirements-dev.txt
npm ci --ignore-scripts
npx playwright install --with-deps chromium
python -B scripts/run_checks.py
python -B scripts/run_checks.py --browser
```

UT 入口执行完整 Python unittest 和 Node 测试。`--browser` 还运行完整 Chromium 套件及 BASIC-001～012 清单核验。命令会把固定 fixture 写到 `data/`、`web/data/`，请在独立开发副本执行，勿在生产采集目录执行。
Linux / WSL 与 CI 最接近；Windows 可运行相同入口，Node 测试文件由脚本枚举，无需依赖 shell 展开通配符。PowerShell 环境变量写法为 `$env:PYTHON='python'`。

## 创建 PR 前必须执行 UT

```sh
git switch -c codex/your-change
git config core.hooksPath .githooks
# 改动、补充相关测试、验证后：
git add <明确的文件>
git commit -m "描述改动"
python -B scripts/submit_pr.py --title "描述改动" --body-file /path/to/pr-body.md
```

PR 正文文件请放在工作区外或 `.tmp/` 内，避免成为未跟踪文件。`submit_pr.py` 要求干净工作区及功能分支，重新运行 UT，复查工作区，再推送当前分支并调用已登录的 GitHub CLI (`gh pr create`)。`--remote NAME` 可指定目标 remote，默认 origin。任何步骤失败都会停止，不使用历史通过报告。

安装的 pre-push hook 同样执行 UT：要求干净工作区、待推 SHA 等于当前 HEAD，拒绝直接推送 main；测试后复查 SHA、分支和工作区。提交脚本也锁定测试前后 SHA 和分支，并推送明确的 SHA。hook 是本地约定，GitHub 网页/API 可以绕过本地 hook；服务端必须同时启用下一节分支保护。GitHub 无法禁止用户创建失败的 PR，但可以禁止它合入。

## 服务端门禁

`.github/workflows/pr-gate.yml` 对所有指向 main 的 PR、merge queue、main 更新及手动运行执行以下检查，不按修改路径跳过：

| 检查 | 验证内容 |
|---|---|
| python-tests | 全量 Python 回归、YAML 结构与故障注入 |
| frontend-tests | 全量 Node、Chromium 与 BASIC 清单 |
| collector-contracts | UBS/Triton 适配器、缓存、隔离与部署验证契约 |
| workflow-lint | 固定版本及 SHA256 的 actionlint |
| Dashboard quality gate | 四项必须全部 success；失败、取消、跳过或缺项均拒绝 |

仓库 Settings → Branches → main 保护规则：必须通过 PR，无需人工批准（批准数为 0，不要求最后一次推送批准，也不要求 Code Owner 批准）；要求当前提交的 `Dashboard quality gate` 成功并在合入前更新分支、解决审查讨论；管理员同样遵守；禁止强推和删除。满足这些条件即可直接合入。目标配置见 [main 保护配置](.github/main-protection.json)。PR 合并后删除远端和本地临时分支。

## 文档与文件维护

- 当前运行入口见 [README](README.md)，文档导航见 [文档索引](docs/README.md)。
- 新增行为必须补充测试；每组完成的改动必须创建 Git commit。
- `audit/` 中冻结证据和规格仍被测试引用，不能作为普通日志批量删除。
- `data/`、`web/data/`、`web/exports/`、`test-results/`、`.tmp/`、本地采集日志和依赖目录不提交。
- 修改工作流后运行 actionlint；PR 检查成功只证明代码门禁，不能代替真实采集及部署验证。
