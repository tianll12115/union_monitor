# 1028 Triton 新需求设计

主文档：[Triton散点图交互与数据准确性需求设计](Triton散点图交互与数据准确性需求设计.md)。包括10项具名需求、可验收条款、双图悬停/pin状态、可靠workflow关联、精确计时、当前选区同PR高亮及测试门禁设计。

此目录是**设计与审计交付**，不包含看板功能实现。用户已确认可靠关联与同提交其他运行分开，后者不计E2E。产品实现需随后按受保护PR流程进行；本轮仅本地提交，不推送远端。

审计结论：用户指定24小时选区的E2E/NPU KPI独立复算与页面一致，4个run的上游job端点对账一致；但33条取消/跳过job记录存在倒置时间被归零、发现截止缺口、导出口径元数据与关联能力等问题，不能宣称全站所有数据准确或已完整验收。

## 离线复现

在仓库根目录运行：

```powershell
python -B -m unittest discover -s tests -p test_triton_1028_design_audit.py -v
```

这些UT验证原始发布文件hash、选区独立计算、4份完整分页上游job响应、异常时间负例和审计结果可复现。完整验证结果见[evidence/verification.json](evidence/verification.json)。不要把审计UT通过理解为未来hover/highlight产品验收通过。

`audit_snapshot.py`只使用标准库，不依赖生产计时/分位数函数。调用`audit(payload, from_ms, to_ms, upstream)`可重算选区及合格样本自洽；`job_duration_check(payload)`检查保留job端点与执行值。它不是完整schema验证器，也不证明未抽查记录的上游身份。

证据大文件以gzip无损存储，例：

```python
import gzip, json
from pathlib import Path
root = Path('docs/requirements/1028-new/evidence')
payload = json.loads(gzip.decompress((root/'published/data/triton.json.gz').read_bytes()))
```

`fetch-index.json`的SHA256指解压后的原始响应字节；上游JSON、发布脚本和DOM证据保留原样。没有浏览器截图文件，原因已在主文档披露。`audit-tool-coverage.json`中的Windows绝对路径是本机覆盖率证据，不是运行依赖。
