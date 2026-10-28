from pathlib import Path
import re,json,hashlib,unittest
ROOT=Path(__file__).resolve().parent
class AuditDocumentTests(unittest.TestCase):
 def setUp(self):self.doc=(ROOT/'Triton页面重新审计与整改需求.md').read_text(encoding='utf8')
 def test_unique_requirements_and_priority_totals(self):
  headers=re.findall(r'^### (TA-\d{3})：',self.doc,re.M)
  self.assertEqual(headers,[f'TA-{i:03d}' for i in range(1,15)])
  counts={p:len(re.findall(r'\| TA-\d{3} \| '+p+r' \|',self.doc)) for p in ['P1','P2','P3']}
  self.assertEqual(counts,{'P1':5,'P2':8,'P3':1})
 def test_every_requirement_has_acceptance(self):
  for i in range(1,15):self.assertIn(f'TA-{i:03d}-AC1',self.doc)
 def test_all_relative_evidence_links_exist(self):
  links=re.findall(r'\]\((evidence/[^)]+)\)',self.doc)
  self.assertGreater(len(links),20)
  for link in links:self.assertTrue((ROOT/link).is_file(),link)
 def test_frozen_source_hashes_match(self):
  rows=json.loads((ROOT/'evidence/fetch-index.json').read_text())
  for row in rows:
   self.assertNotIn('error',row)
   self.assertEqual(hashlib.sha256((ROOT/'evidence/live'/row['path']).read_bytes()).hexdigest(),row['sha256'])
 def test_numeric_and_browser_evidence_agree(self):
  data=json.loads((ROOT/'evidence/live/data/triton.json').read_text());geometry=json.loads((ROOT/'evidence/browser/geometry-desktop.json').read_text())
  self.assertEqual(len(data['batches']),345)
  self.assertEqual(len(geometry['charts'][0]['marks']),345)
  axis=geometry['charts'][0];self.assertLess(axis['ticks'][0]['box']['left'],axis['sectionLeft'])
  dis=json.loads((ROOT/'evidence/browser/geometry-reconciliation.json').read_text())
  self.assertEqual([v['moved'] for v in dis],[316,213])
  cold=json.loads((ROOT/'evidence/browser/cold-detail.json').read_text())
  self.assertIn('batch=',cold['requested']);self.assertNotIn('batch=',cold['actual']['url']);self.assertFalse(cold['actual']['open'])
 def test_audit_only_scope_and_limitations_are_explicit(self):
  for text in ['本轮没有实施修复','C：','未完成：','待实现','没有修改应用代码','本轮未授权远端代码仓提交']:self.assertIn(text,self.doc)
if __name__=='__main__':unittest.main(verbosity=2)
