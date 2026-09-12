"""Command-line interface for the RLM harness.

Usage::

    python -m rlm.cli --file path/to/document.txt --query "Your question"

Trajectory diagnostics are written to stderr; only the final answer goes to stdout.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from rlm.agent import RLMRunner
from rlm.config import Settings


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="rlm",
        description="Recursive Language Model (RLM) inference harness.",
    )
    parser.add_argument(
        "--file",
        type=str,
        required=True,
        help="Path to the input document.",
    )
    parser.add_argument(
        "--query",
        type=str,
        required=True,
        help="The question to answer over the document.",
    )
    return parser


def main(argv: list[str] | None = None) -> None:
    """CLI entry point.

    Args:
        argv: Argument list (defaults to ``sys.argv[1:]``).
    """
    parser = _build_parser()
    args = parser.parse_args(argv)

    # Read document
    doc_path = Path(args.file)
    if not doc_path.exists():
        print(f"Error: file not found: {doc_path}", file=sys.stderr)
        sys.exit(1)

    document = doc_path.read_text(encoding="utf-8")
    query = args.query

    # Combine document and query into the prompt text that becomes `context`
    prompt_text = f"DOCUMENT:\n{document}\n\nQUERY:\n{query}"

    settings = Settings()
    runner = RLMRunner(settings=settings)

    print(f"[RLM] Document loaded: {len(document):,} characters", file=sys.stderr)
    print(f"[RLM] Query: {query}", file=sys.stderr)
    print(f"[RLM] Root model: {settings.ROOT_MODEL}", file=sys.stderr)
    print(f"[RLM] Worker model: {settings.WORKER_MODEL}", file=sys.stderr)
    print(f"[RLM] Max iterations: {settings.MAX_ITERATIONS}", file=sys.stderr)
    print("-" * 60, file=sys.stderr)

    result = runner.run(prompt_text)

    # --- Trajectory diagnostics to stderr ---
    for step in result.trajectory:
        print(f"\n--- Iteration {step.iteration} ---", file=sys.stderr)
        if step.code_executed:
            print(f"[Code]\n{step.code_executed}", file=sys.stderr)
        if step.repl_output is not None:
            preview = step.repl_output[:500]
            print(f"[Stdout preview]\n{preview}", file=sys.stderr)
        if step.sub_call_count:
            print(f"[Sub-calls this step: {step.sub_call_count}]", file=sys.stderr)

    print("-" * 60, file=sys.stderr)
    print(
        f"[RLM] Finished — terminated: {result.terminated}, "
        f"total sub-calls: {result.total_sub_calls}",
        file=sys.stderr,
    )

    # --- Final answer to stdout ---
    print(result.answer)


if __name__ == "__main__":
    main()
