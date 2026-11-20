"""Fixtures for the tests of the extension's runner, gurita-vscode/runner.py.

The runner is imported in process as the module `runner` from the extension's directory, and
no test starts a shell session or a host command: the tests drive line-kind inference, the
fixed-line verdict, rule matching and the default, and the check step and the preview print,
the last two through `runner.main`.
"""

import sys
from pathlib import Path

import pytest

# The extension's directory is packaged into the VSIX, so importing the runner from it must
# leave no __pycache__ behind there.
sys.dont_write_bytecode = True

EXTENSION_DIR = Path(__file__).resolve().parent.parent
if str(EXTENSION_DIR) not in sys.path:
    sys.path.insert(0, str(EXTENSION_DIR))

import runner as runner_module  # noqa: E402

FIXED_LINE_ROWS = (
    ("success", "Task completed."),
    ("no-op", "No task completed — no file changed."),
    ("stop", "No task matches the given name."),
    ("stop", "Scope gate closed — the scope is held or could not be checked."),
    ("verdict", "Requirements converged — ready for task derivation."),
)


@pytest.fixture
def runner():
    """The runner module."""
    return runner_module


@pytest.fixture
def fixed_lines_file(tmp_path):
    """A fixed-line file in the bundled `kind<TAB>line` form, one row of each kind."""
    path = tmp_path / "fixed_lines.tsv"
    path.write_text("".join(f"{kind}\t{line}\n" for kind, line in FIXED_LINE_ROWS), encoding="utf-8")
    return path


@pytest.fixture
def fixed_lines(runner, fixed_lines_file):
    """The fixture file's lines mapped to their kinds, as the runner reads them."""
    return runner.read_fixed_lines(str(fixed_lines_file))
