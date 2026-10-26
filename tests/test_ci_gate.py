"""The required PR result must fail closed when a prerequisite did not pass."""
import copy
import json
import subprocess
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "ci_gate.py"
REQUIRED = {"python-tests", "frontend-tests", "collector-contracts", "workflow-lint"}
REQUIRED_JOBS_ORDER = ["python-tests", "frontend-tests", "collector-contracts", "workflow-lint"]


class RequiredGateTests(unittest.TestCase):
    def run_gate(self, results):
        return subprocess.run(
            [sys.executable, str(SCRIPT), "--results", json.dumps(results)],
            cwd=ROOT, capture_output=True, text=True,
        )

    def test_every_required_job_must_have_succeeded(self):
        result = self.run_gate({job: {"result": "success"} for job in REQUIRED})
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_failure_cancel_and_skip_never_become_green(self):
        for outcome in ("failure", "cancelled", "skipped", None):
            with self.subTest(outcome=outcome):
                results = {job: {"result": "success"} for job in REQUIRED}
                results["collector-contracts"]["result"] = outcome
                result = self.run_gate(results)
                self.assertEqual(result.returncode, 1)
                self.assertIn("collector-contracts", result.stdout + result.stderr)

    def test_missing_or_unexpected_job_is_not_an_acceptable_gate(self):
        results = {job: {"result": "success"} for job in REQUIRED}
        del results["workflow-lint"]
        self.assertEqual(self.run_gate(results).returncode, 1)
        results["replacement"] = {"result": "success"}
        self.assertEqual(self.run_gate(results).returncode, 1)

    def test_bad_json_is_an_explicit_failed_check(self):
        result = subprocess.run([sys.executable, str(SCRIPT), "--results", "{"],
                                cwd=ROOT, capture_output=True, text=True)
        self.assertEqual(result.returncode, 1)
        self.assertIn("JSON", result.stdout + result.stderr)


class PullRequestWorkflowTests(unittest.TestCase):
    def test_gate_covers_every_pr_and_runs_after_failed_dependencies(self):
        workflow = ROOT / ".github" / "workflows" / "pr-gate.yml"
        self.assertTrue(workflow.is_file())
        text = workflow.read_text("utf-8")
        self.assertIn("pull_request:", text)
        self.assertIn("merge_group:", text)
        self.assertNotIn("pull_request_target:", text)
        self.assertNotIn("paths-ignore:", text)
        self.assertNotIn("secrets.", text)
        self.assertNotIn("continue-on-error:", text)
        self.assertIn("contents: read", text)
        self.assertIn("fetch-depth: 0", text)
        self.assertIn("name: Dashboard quality gate", text)
        self.assertIn("if: ${{ always() }}", text)
        self.assertIn("toJSON(needs)", text)
        self.assertIn("python scripts/ci_gate.py", text)
        for job in REQUIRED:
            self.assertIn(job + ":", text)


class WorkflowYamlStructureTests(unittest.TestCase):
    """PSG-006: parse pr-gate.yml and reject structural bypasses deterministically.

    The text-based assertions above cannot tell whether the real browser step
    was replaced by an `echo`, whether the package.json script was reduced to
    ``--list``/single-file, whether the manifest verification was removed, or
    whether the aggregate gate was weakened. These parse the actual structure
    (and package.json) and add mutation cases that must be rejected.
    """

    WORKFLOW_PATH = ROOT / ".github" / "workflows" / "pr-gate.yml"
    PACKAGE_PATH = ROOT / "package.json"

    def setUp(self):
        try:
            import yaml as _yaml  # type: ignore
        except ImportError:  # pragma: no cover - CI installs PyYAML==6.0.3
            raise unittest.SkipTest("PyYAML not installed")

        # GitHub's top-level `on:` key is parsed as YAML 1.1 boolean `True` by
        # PyYAML's default resolver. Drop the bool resolver so `on:` stays the
        # string "on" (this does not affect any structural check below).
        class _WorkflowLoader(_yaml.SafeLoader):
            pass
        _WorkflowLoader.yaml_implicit_resolvers = {
            key: [resolver for resolver in resolvers
                  if resolver[0] != "tag:yaml.org,2002:bool"]
            for key, resolvers in _yaml.SafeLoader.yaml_implicit_resolvers.items()
        }

        self._workflow = _yaml.load(
            self.WORKFLOW_PATH.read_text("utf-8"), Loader=_WorkflowLoader)
        self._package = json.loads(self.PACKAGE_PATH.read_text("utf-8"))

    # -- helpers -----------------------------------------------------------
    @classmethod
    def _critical_run_steps(cls, workflow):
        """Return (job_name, step) for every step that must execute a real check.

        These steps are the actual command boundaries the gate depends on; a
        conditional ``if`` on any of them is an execution-step bypass (ADR-022).
        """
        critical_runs = {
            "python-tests": ("unittest discover",),
            "frontend-tests": ("node --test tests/*.test.cjs",
                               "scripts/devdata.py --offline",
                               "verify_basic_junit.py",
                               "npm run test:browser", "playwright test", "verify_changed_coverage.py"),
            "collector-contracts": ("unittest discover",),
            "workflow-lint": ("actionlint",),
            "quality-gate": ("scripts/ci_gate.py",),
        }
        found = []
        jobs = workflow.get("jobs") or {}
        for job_name, needles in critical_runs.items():
            job = jobs.get(job_name)
            if not isinstance(job, dict):
                continue
            for step in job.get("steps", []):
                run = step.get("run")
                if not (isinstance(run, str) and run.strip()):
                    continue
                if any(needle in run for needle in needles):
                    found.append((job_name, step))
        return found

    @staticmethod
    def _job_runs(job):
        runs = []
        for step in job.get("steps", []):
            run = step.get("run")
            if isinstance(run, str) and run.strip():
                runs.append(run)
        return runs

    @staticmethod
    def _find_keys(obj, target):
        found = []
        if isinstance(obj, dict):
            for key, value in obj.items():
                if key in target:
                    found.append(key)
                found.extend(WorkflowYamlStructureTests._find_keys(value, target))
        elif isinstance(obj, list):
            for item in obj:
                found.extend(WorkflowYamlStructureTests._find_keys(item, target))
        return found

    @staticmethod
    def _contains_paths(obj):
        if isinstance(obj, str):
            return "paths" in obj
        if isinstance(obj, dict):
            return any("paths" in str(key)
                       or WorkflowYamlStructureTests._contains_paths(value)
                       for key, value in obj.items())
        if isinstance(obj, list):
            return any(WorkflowYamlStructureTests._contains_paths(value)
                       for value in obj)
        return False

    @classmethod
    def _validate(cls, workflow):
        problems = []

        on = workflow.get("on") or {}
        if on.get("pull_request", {}).get("branches") != ["main"]:
            problems.append("on.pull_request.branches must be exactly ['main']")
        if "merge_group" not in on:
            problems.append("on.merge_group must be present")
        if "pull_request_target" in on:
            problems.append("on.pull_request_target must be absent")
        if cls._contains_paths(on):
            problems.append("no trigger may declare paths-ignore/paths")

        jobs = workflow.get("jobs") or {}

        # Each required job must actually execute its real check.
        required_runs = {
            "python-tests": ("unittest discover",),
            "frontend-tests": ("node --test tests/*.test.cjs",
                               "scripts/devdata.py --offline",
                               "verify_basic_junit.py", "verify_changed_coverage.py", "coverage run", "npx c8"),
            "collector-contracts": ("unittest discover",),
            "workflow-lint": ("actionlint",),
        }
        for job_name in REQUIRED_JOBS_ORDER:
            job = jobs.get(job_name)
            if not isinstance(job, dict):
                problems.append(f"job {job_name!r} missing")
                continue
            if job.get("runs-on") != "ubuntu-latest":
                problems.append(f"job {job_name!r} must run on ubuntu-latest")
            runs = cls._job_runs(job)
            if not runs:
                problems.append(f"job {job_name!r} has no runnable steps")
            for needle in required_runs[job_name]:
                if not any(needle in run for run in runs):
                    problems.append(f"job {job_name!r} must execute {needle!r}")

        # frontend-tests must drive the FULL browser suite, not --list/single.
        fruns = cls._job_runs(jobs.get("frontend-tests", {}))
        if not any(run == "npm run test:browser" or run == "playwright test"
                   for run in fruns):
            problems.append("frontend-tests must run the full browser suite "
                            "(npm run test:browser / playwright test)")

        # ADR-022: an execution step must not be conditionally skipped. Any
        # ``if`` on a step that carries a real check command is a bypass.
        for job_name, step in cls._critical_run_steps(workflow):
            if "if" in step:
                problems.append(f"job {job_name!r} step {step.get('run')!r} must "
                                f"execute unconditionally but declares if: {step['if']!r}")

        gate = jobs.get("quality-gate")
        if isinstance(gate, dict):
            needs = gate.get("needs")
            if needs != REQUIRED_JOBS_ORDER:
                problems.append(f"quality-gate.needs must be exactly "
                                f"{REQUIRED_JOBS_ORDER!r}, got {needs!r}")
            if gate.get("if") not in ("always()", "${{ always() }}"):
                problems.append("quality-gate.if must be always() / ${{ always() }}")
            if not any("scripts/ci_gate.py" in run for run in cls._job_runs(gate)):
                problems.append("quality-gate must run scripts/ci_gate.py")
        else:
            problems.append("quality-gate job missing")

        permissions = workflow.get("permissions") or {}
        if permissions.get("contents") != "read":
            problems.append("permissions.contents must be 'read'")

        forbidden = cls._find_keys(workflow, {"continue-on-error", "paths-ignore"})
        if forbidden:
            problems.append(f"forbidden keys present: {sorted(set(forbidden))}")

        return problems

    # -- positive structure contract --------------------------------------
    def test_workflow_structure_contract(self):
        self.assertEqual(self._validate(self._workflow), [])

    def test_package_json_scripts_run_full_suite_and_verify(self):
        scripts = self._package.get("scripts", {})
        self.assertEqual(scripts.get("test:browser"), "playwright test")
        self.assertEqual(scripts.get("test:browser:verify"),
                         "python scripts/verify_basic_junit.py")

    # -- mutation cases must be rejected -----------------------------------
    def test_mutation_missing_browser_step_is_rejected(self):
        workflow = copy.deepcopy(self._workflow)
        steps = workflow["jobs"]["frontend-tests"]["steps"]
        for step in steps:
            if step.get("run") == "npm run test:browser":
                step.pop("run")
                break
        problems = self._validate(workflow)
        self.assertTrue(problems, "missing browser step must be rejected")

    def test_mutation_missing_or_conditional_coverage_gate_is_rejected(self):
        for conditional in (False, True):
            workflow = copy.deepcopy(self._workflow)
            for step in workflow['jobs']['frontend-tests']['steps']:
                if 'verify_changed_coverage.py' in step.get('run', ''):
                    if conditional:
                        step['if'] = '${{ false }}'
                    else:
                        step.pop('run')
            self.assertTrue(self._validate(workflow))

    def test_mutation_echo_browser_step_is_rejected(self):
        workflow = copy.deepcopy(self._workflow)
        for step in workflow["jobs"]["frontend-tests"]["steps"]:
            if step.get("run") == "npm run test:browser":
                step["run"] = "echo skipped browser tests"
        problems = self._validate(workflow)
        self.assertTrue(problems, "echoed browser step must be rejected")

    def test_mutation_conditional_skip_browser_step_is_rejected(self):
        # ADR-022: `if: ${{ false }}` on the real browser step is a structural
        # bypass that must be rejected, not accepted as a still-present step.
        workflow = copy.deepcopy(self._workflow)
        for step in workflow["jobs"]["frontend-tests"]["steps"]:
            if step.get("run") == "npm run test:browser":
                step["if"] = "${{ false }}"
                break
        problems = self._validate(workflow)
        self.assertTrue(problems, "conditionally-skipped browser step must be rejected")
        self.assertTrue(any("must execute unconditionally" in p for p in problems), problems)

    def test_mutation_conditional_skip_collector_step_is_rejected(self):
        workflow = copy.deepcopy(self._workflow)
        steps = workflow["jobs"]["collector-contracts"]["steps"]
        for step in steps:
            if isinstance(step.get("run"), str) and "unittest discover" in step["run"]:
                step["if"] = "false"
                break
        problems = self._validate(workflow)
        self.assertTrue(problems, "conditionally-skipped collector step must be rejected")

    def test_mutation_continue_on_error_is_rejected(self):
        workflow = copy.deepcopy(self._workflow)
        workflow["jobs"]["frontend-tests"]["steps"][-1]["continue-on-error"] = True
        problems = self._validate(workflow)
        self.assertTrue(problems, "continue-on-error must be rejected")

    def test_mutation_missing_needs_is_rejected(self):
        workflow = copy.deepcopy(self._workflow)
        workflow["jobs"]["quality-gate"]["needs"] = [
            "python-tests", "frontend-tests", "collector-contracts"]
        problems = self._validate(workflow)
        self.assertTrue(problems, "reduced needs must be rejected")

    def test_mutation_missing_manifest_verification_is_rejected(self):
        workflow = copy.deepcopy(self._workflow)
        steps = workflow["jobs"]["frontend-tests"]["steps"]
        workflow["jobs"]["frontend-tests"]["steps"] = [
            s for s in steps
            if not (isinstance(s.get("run"), str)
                    and "verify_basic_junit.py" in s["run"])]
        problems = self._validate(workflow)
        self.assertTrue(problems, "missing manifest verification must be rejected")


if __name__ == "__main__":
    unittest.main()
