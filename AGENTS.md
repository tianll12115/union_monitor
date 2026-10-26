# 注意事项

- 每次改动完成后，都必须创建一个对应的Git commit，以便后续追踪和回滚。
- 每次改动后，都必须编写或更新相关测试，并在交付给用户前，确保所有测试和验证全部通过。
- 每次提交都必须编写或更新对应的单元测试（UT）；没有任何 UT 覆盖的改动不得提交。
- 新增代码（相对于合并基 `main` 的 diff 中新增或修改的行）的行覆盖率必须大于 80%；提交前须能证明覆盖率达标，未达标则先补齐测试再提交。

# 代码提交与合入规范（GitHub）

- 严禁移除或绕过 `main` 分支保护，尤其是以下两项：
  - `required_status_checks`（必需状态检查 `Dashboard quality gate`）
  - `required_pull_request_reviews`（必须通过 PR 合入；`required_approving_review_count: 0`，`require_last_push_approval: false`，无需人工批准）
- 所有代码合入 `main` 一律走 Fork-Pull（Pull Request）流程：在分支上提交并推送，创建 Pull Request，不得直接推送到 `main`。
- 合入前必须等待 CI 门禁 `Dashboard quality gate`（python-tests / frontend-tests / collector-contracts / workflow-lint）全部通过（绿色）后，才能合并 PR 进 `main`。
- PR 门禁中的测试任务必须执行全量单元测试（UT），作为质量防护的一环：`python-tests` 运行全量 Python 套件（`python -B -m unittest discover -s tests -v`），`frontend-tests` 运行全部 Node 与浏览器测试；不得通过裁剪测试子集、跳过用例或条件化跳过关键用例来换取绿灯。
- 当前 PR 提交的全部门禁通过、分支与 main 同步且没有合并冲突时，可以直接合入，无需人工批准，也不强制解决审查讨论；不得使用旧提交的绿灯代替当前提交结果。目标保护配置见 `.github/main-protection.json`。
- 门禁失败（红色）时，先修复代码并重新推送，让门禁转绿后再合并；不得通过临时移除保护或直接推送绕过门禁。
- PR 合并后删除该临时分支，远端与本地只保留 `main` 一个分支。
