import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

from scripts import run_checks


class HookEnvironmentTests(unittest.TestCase):
    def test_gate_subprocesses_do_not_inherit_git_local_repository_variables(self):
        variables = {'GIT_DIR': 'foreign', 'GIT_WORK_TREE': 'elsewhere', 'GIT_INDEX_FILE': 'foreign-index',
                     'DASHBOARD_TEST_SETTING': 'preserved'}
        with patch.dict(os.environ, variables), patch.object(run_checks, 'commands', return_value=[['python', '-V']]), \
                patch.object(run_checks, 'git_output', return_value='GIT_DIR\nGIT_WORK_TREE\nGIT_INDEX_FILE'), \
                patch.object(run_checks.subprocess, 'run') as run:
            run_checks.check()
            environment = run.call_args.kwargs['env']
            self.assertEqual(environment['DASHBOARD_TEST_SETTING'], 'preserved')
            self.assertTrue(all(key not in environment for key in variables if key.startswith('GIT_')))
            self.assertEqual(os.environ['GIT_DIR'], 'foreign', 'reference guards retain their parent context')

    def test_real_hook_context_allows_tests_to_create_independent_git_repositories(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            bare = root/'source.git'
            child = root/'child'
            subprocess.run(['git', 'init', '--bare', '--quiet', str(bare)], check=True)
            code = "import os,subprocess,sys; assert 'GIT_DIR' not in os.environ; subprocess.run(['git','init','--quiet',sys.argv[1]],check=True)"
            with patch.dict(os.environ, {'GIT_DIR': str(bare)}), \
                    patch.object(run_checks, 'commands', return_value=[[sys.executable, '-c', code, str(child)]]):
                run_checks.check()
            self.assertTrue((child/'.git').is_dir())
            value = subprocess.check_output(['git', '-C', str(child), 'rev-parse', '--is-inside-work-tree'], text=True)
            self.assertEqual(value.strip(), 'true')
