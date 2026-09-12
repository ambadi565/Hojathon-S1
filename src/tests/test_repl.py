"""Unit tests for ``rlm.repl.PersistentREPL``.

Verifies:
- State persists across multiple ``execute()`` calls.
- stdout is captured and truncated at the configured limit.
- Syntax and runtime errors return tracebacks without crashing.
- ``llm_query`` can be invoked inside loops with mocked worker responses.
- The ``context`` variable is available after initialization.
"""

from __future__ import annotations

from unittest.mock import MagicMock

import pytest

from rlm.config import Settings
from rlm.repl import PersistentREPL


# ------------------------------------------------------------------
# Fixtures
# ------------------------------------------------------------------

@pytest.fixture()
def repl() -> PersistentREPL:
    """Return a fresh ``PersistentREPL`` with a small truncation limit for tests."""
    settings = Settings(STDOUT_TRUNCATION_LIMIT=2000)
    return PersistentREPL(settings=settings)


# ------------------------------------------------------------------
# Test: state persistence
# ------------------------------------------------------------------

def test_state_persists_across_calls(repl: PersistentREPL) -> None:
    """Variables assigned in one call should be visible in subsequent calls."""
    output1, ok1, exc1 = repl.execute("x = 42")
    assert ok1
    assert exc1 is None

    output2, ok2, exc2 = repl.execute("print(x)")
    assert ok2
    assert "42" in output2


def test_state_accumulates(repl: PersistentREPL) -> None:
    """Multiple assignments should all be retained."""
    repl.execute("a = 1")
    repl.execute("b = 2")
    output, ok, _ = repl.execute("print(a + b)")
    assert ok
    assert "3" in output


# ------------------------------------------------------------------
# Test: stdout capture and truncation
# ------------------------------------------------------------------

def test_stdout_is_captured(repl: PersistentREPL) -> None:
    """Print output should appear in the returned string."""
    output, ok, _ = repl.execute("print('hello world')")
    assert ok
    assert "hello world" in output


def test_stdout_truncation(repl: PersistentREPL) -> None:
    """Output exceeding the limit should be truncated with a marker."""
    # The fixture sets STDOUT_TRUNCATION_LIMIT=2000
    code = "print('A' * 5000)"
    output, ok, _ = repl.execute(code)
    assert ok
    assert len(output) < 5100  # truncated + marker, much less than 5000
    assert "[Truncated: output exceeded limit]" in output


def test_stdout_not_truncated_when_within_limit(repl: PersistentREPL) -> None:
    """Short output should not be truncated."""
    output, ok, _ = repl.execute("print('short')")
    assert ok
    assert "[Truncated" not in output


# ------------------------------------------------------------------
# Test: error handling
# ------------------------------------------------------------------

def test_syntax_error_returns_traceback(repl: PersistentREPL) -> None:
    """A syntax error should be caught and reported as a traceback string."""
    output, ok, exc = repl.execute("def foo(")
    assert not ok
    assert exc is not None
    assert "SyntaxError" in output


def test_runtime_error_returns_traceback(repl: PersistentREPL) -> None:
    """A runtime error should be caught and reported without crashing."""
    output, ok, exc = repl.execute("1 / 0")
    assert not ok
    assert exc is not None
    assert "ZeroDivisionError" in output


def test_name_error_returns_traceback(repl: PersistentREPL) -> None:
    """Referencing an undefined name should produce a NameError traceback."""
    output, ok, exc = repl.execute("print(undefined_variable)")
    assert not ok
    assert "NameError" in output


# ------------------------------------------------------------------
# Test: llm_query injection
# ------------------------------------------------------------------

def test_llm_query_callable_in_code(repl: PersistentREPL) -> None:
    """The injected ``llm_query`` should be callable from executed code."""
    mock_worker = MagicMock(return_value="mocked answer")
    repl.inject_llm_query(mock_worker)

    output, ok, _ = repl.execute("result = llm_query('test prompt')\nprint(result)")
    assert ok
    assert "mocked answer" in output
    mock_worker.assert_called_once_with("test prompt")


def test_llm_query_in_loop(repl: PersistentREPL) -> None:
    """``llm_query`` should work when called inside a loop."""
    call_count = 0

    def mock_worker(prompt: str) -> str:
        nonlocal call_count
        call_count += 1
        return f"response-{call_count}"

    repl.inject_llm_query(mock_worker)

    code = (
        "answers = []\n"
        "for i in range(3):\n"
        "    answers.append(llm_query(f'query {i}'))\n"
        "print(answers)\n"
    )
    output, ok, _ = repl.execute(code)
    assert ok
    assert call_count == 3
    assert "response-1" in output
    assert "response-3" in output


# ------------------------------------------------------------------
# Test: context variable
# ------------------------------------------------------------------

def test_context_available_after_set(repl: PersistentREPL) -> None:
    """After ``set_context``, the ``context`` variable should be accessible."""
    repl.set_context("hello context")
    output, ok, _ = repl.execute("print(context)")
    assert ok
    assert "hello context" in output


def test_context_slicing(repl: PersistentREPL) -> None:
    """Code should be able to slice ``context``."""
    repl.set_context("abcdefghij")
    output, ok, _ = repl.execute("print(context[:5])")
    assert ok
    assert "abcde" in output


# ------------------------------------------------------------------
# Test: pre-imported modules
# ------------------------------------------------------------------

def test_preimported_modules(repl: PersistentREPL) -> None:
    """``re``, ``math``, ``json``, and ``collections`` should be available."""
    output, ok, _ = repl.execute(
        "print(math.sqrt(16), json.dumps({'a': 1}), "
        "bool(re.match(r'\\d+', '42')), "
        "type(collections.Counter()).__name__)"
    )
    assert ok
    assert "4.0" in output
    assert '{"a": 1}' in output
