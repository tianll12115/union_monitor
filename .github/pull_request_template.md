## 改动

说明问题、变更后的行为及清理内容。

## 提交前验证

- [ ] 已执行 `python -B scripts/run_checks.py`（完整 Python / Node UT）
- [ ] 已执行 `python -B scripts/run_checks.py --browser`（完整 Chromium、BASIC/Triton 必跑旅程）
- [ ] 本次 `test-results/changed-coverage.json` 证明新增可执行代码行覆盖率严格大于 80%
- [ ] 补充或更新测试，且对应代码已创建 commit
- [ ] 未提交原始缓存、凭据、临时日志或生成快照

测试命令与结果：

## 合入条件

当前提交的四项检查和 **Dashboard quality gate** 全绿、分支与 main 同步且无合并冲突后即可合入，无需人工批准，不强制解决审查讨论。
不得直推 main、绕过分支保护或跳过失败检查。合并后删除临时分支。
