"""Reproduce contract/report acceptance gaps; no workflow or product edits."""
import copy
import importlib.util
import json
import subprocess
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = next(p for p in Path(__file__).resolve().parents if (p / 'catalog.json').is_file())
sys.path.insert(0, str(ROOT))
spec = importlib.util.spec_from_file_location('audit_ci_contract', ROOT / 'tests/test_ci_gate.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
case = module.WorkflowYamlStructureTests()
case.setUp()
workflow = copy.deepcopy(case._workflow)
for step in workflow['jobs']['frontend-tests']['steps']:
    if step.get('run') == 'npm run test:browser':
        step['if'] = '${{ false }}'
from scripts.verify_basic_junit import load_required_ids
required = load_required_ids(ROOT / 'tests/browser/basic-journeys.json')
xml = ET.Element('testsuites')
suite = ET.SubElement(xml, 'testsuite')
ET.SubElement(suite, 'testcase', name=' '.join(required))
for i in range(len(required) - 1):
    ET.SubElement(suite, 'testcase', name=f'unrelated filler {i}')
out = Path(__file__).resolve().parent
junit = out / 'probe-forged-junit.xml'
ET.ElementTree(xml).write(junit, encoding='utf-8', xml_declaration=True)
run = subprocess.run([sys.executable, str(ROOT / 'scripts/verify_basic_junit.py'), '--junit', str(junit)],
                     cwd=ROOT, text=True, capture_output=True)
result = {
    'browser_step_false_condition_contract_problems': case._validate(workflow),
    'fabricated_12_testcase_report_one_case_all_ids_accepted': run.returncode == 0,
    'verifier_returncode': run.returncode,
    'boundary': 'A single skipped browser step still fails real CI because the next step has no fresh JUnit. '
                'These probes demonstrate contract and report-validator gaps, not a standalone production CI bypass.',
}
(out / 'ecpsg-probes.json').write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
print(json.dumps(result, indent=2))
