## 改动

说明问题、变更后的行为及清理内容。

## 提交前验证

- [ ] 已执行 `python -B scripts/run_checks.py`（完整 Python / Node UT）
- [ ] 涉及交互时执行 `python -B scripts/run_checks.py --browser`
- [ ] 补充或更新测试，且对应代码已创建 commit
- [ ] 未提交原始缓存、凭据、临时日志或生成快照

测试命令与结果：

## 合入条件

等待四项检查和 **Dashboard quality gate** 全绿，并获得所需审查。
不得直推 main、绕过分支保护或跳过失败检查。合并后删除临时分支。
