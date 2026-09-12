"""Demo script for the RLM harness.

Generates a synthetic document of 150,000+ characters with facts scattered
throughout, then runs an RLM query over it to demonstrate the recursive
analysis approach.

Usage::

    # 1. Set your API key:
    export GEMINI_API_KEY="AIzaSy..."
    # — or create a .env file in the src/ directory:
    echo "GEMINI_API_KEY=AIzaSy..." > src/.env

    # 2. Run the demo:
    python src/example.py

Note: This script requires a valid Gemini API key because it makes live
calls to ``gemini-2.5-pro`` (root) and ``gemini-2.5-flash`` (worker).
"""

from __future__ import annotations

import sys
import random
import textwrap

# Ensure the src directory is on the path so we can import rlm
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from rlm.agent import RLMRunner  # noqa: E402
from rlm.config import Settings  # noqa: E402


def generate_synthetic_document(target_length: int = 160_000, seed: int = 42) -> str:
    """Generate a synthetic document with facts scattered throughout.

    The document consists of "filler" paragraphs interspersed with clearly
    marked facts that the RLM should be able to locate and summarise.

    Args:
        target_length: Approximate target character count.
        seed: Random seed for reproducibility.

    Returns:
        A string of at least *target_length* characters.
    """
    rng = random.Random(seed)

    # Facts to scatter throughout the document
    facts = [
        "FACT-001: The Zephyr-9 satellite was launched on 14 March 2024 and orbits at 550 km altitude.",
        "FACT-002: Project Helios achieved a 34.7% efficiency record for perovskite solar cells.",
        "FACT-003: The Mariana Data Centre processes 2.4 exabytes of oceanographic data per year.",
        "FACT-004: Dr. Elena Vasquez received the Turing Award in 2025 for contributions to program synthesis.",
        "FACT-005: The Arctic Seed Vault added 12,000 new crop varieties in its 2024 deposit.",
        "FACT-006: Quantum processor Obsidian-Q achieved 1,200 logical qubits with error rates below 0.01%.",
        "FACT-007: The Trans-Pacific Fibre Link operates at 800 terabits per second across 12,000 km.",
        "FACT-008: BioForge synthesised a novel antibiotic, Cephalotrin-X, effective against MRSA.",
        "FACT-009: The Lunar Gateway station completed its third crewed rotation in December 2025.",
        "FACT-010: The Global Carbon Capture Alliance removed 4.2 million tonnes of CO₂ in 2025.",
    ]

    # Filler paragraph templates
    filler_templates = [
        "In the field of {field}, researchers have continued to make incremental progress. "
        "The latest studies suggest that {topic} remains a challenging but promising area. "
        "Conferences held throughout {year} showcased a variety of approaches, though many "
        "questions remain unanswered. Funding agencies have allocated additional resources "
        "to support ongoing investigations in this domain.",

        "A comprehensive review of the literature on {topic} reveals several key trends. "
        "First, the adoption of machine-learning techniques has accelerated dramatically. "
        "Second, cross-disciplinary collaboration between {field} and adjacent fields has "
        "yielded novel insights. Third, the reproducibility of results continues to be "
        "a matter of debate among practitioners.",

        "The {year} annual report from the International {field} Consortium highlighted "
        "record participation from over 140 countries. Keynote speakers addressed topics "
        "ranging from {topic} to ethical considerations in applied research. Panel "
        "discussions were particularly lively, with attendees debating the merits of "
        "open-source versus proprietary approaches.",

        "Historical analysis shows that {field} has undergone significant transformation "
        "over the past two decades. Early work focused on foundational theory, while "
        "recent efforts have shifted toward practical applications of {topic}. The "
        "transition has not been without controversy, as some scholars argue that "
        "theoretical rigour has been sacrificed in favour of empirical results.",
    ]

    fields = [
        "materials science", "computational biology", "climate modelling",
        "renewable energy", "artificial intelligence", "quantum computing",
        "space exploration", "ocean sciences", "genomics", "robotics",
    ]
    topics = [
        "nanostructured composites", "protein folding prediction",
        "atmospheric CO₂ dynamics", "perovskite photovoltaics",
        "large language models", "error-corrected qubits",
        "in-situ resource utilisation", "deep-sea sensor networks",
        "single-cell transcriptomics", "autonomous navigation",
    ]
    years = ["2023", "2024", "2025"]

    parts: list[str] = []
    current_length = 0
    fact_positions = sorted(rng.sample(range(50, 500), len(facts)))

    paragraph_index = 0
    fact_index = 0

    while current_length < target_length:
        # Insert a fact at the scheduled positions
        if fact_index < len(facts) and paragraph_index == fact_positions[fact_index]:
            parts.append(f"\n[{facts[fact_index]}]\n")
            current_length += len(facts[fact_index]) + 4
            fact_index += 1

        # Generate a filler paragraph
        template = rng.choice(filler_templates)
        paragraph = template.format(
            field=rng.choice(fields),
            topic=rng.choice(topics),
            year=rng.choice(years),
        )
        parts.append(paragraph + "\n\n")
        current_length += len(paragraph) + 2
        paragraph_index += 1

    return "".join(parts)


def main() -> None:
    """Run the RLM demo."""
    settings = Settings()

    if not settings.GEMINI_API_KEY:
        print(
            textwrap.dedent("""\
            ╔══════════════════════════════════════════════════════════════╗
            ║  GEMINI_API_KEY is not set.                                ║
            ║                                                            ║
            ║  Set it via environment variable:                          ║
            ║    export GEMINI_API_KEY="AIzaSy..."                       ║
            ║                                                            ║
            ║  Or add it to your .env file in src/.env:                  ║
            ║    GEMINI_API_KEY=AIzaSy...                                ║
            ╚══════════════════════════════════════════════════════════════╝
            """),
            file=sys.stderr,
        )
        sys.exit(1)

    # Generate synthetic document
    print("[Demo] Generating synthetic document...", file=sys.stderr)
    document = generate_synthetic_document()
    print(f"[Demo] Document length: {len(document):,} characters", file=sys.stderr)

    # Compose the query
    query = (
        "Find ALL numbered facts (FACT-001 through FACT-010) scattered throughout "
        "this document and produce a numbered summary list of each fact."
    )
    prompt_text = f"DOCUMENT:\n{document}\n\nQUERY:\n{query}"

    print(f"[Demo] Query: {query}", file=sys.stderr)
    print("-" * 60, file=sys.stderr)

    # Run the RLM
    runner = RLMRunner(settings=settings)
    result = runner.run(prompt_text)

    # Print trajectory
    for step in result.trajectory:
        print(f"\n--- Iteration {step.iteration} ---", file=sys.stderr)
        if step.code_executed:
            print(f"[Code]\n{step.code_executed[:300]}", file=sys.stderr)
        if step.repl_output is not None:
            print(f"[Output preview]\n{step.repl_output[:300]}", file=sys.stderr)
        if step.sub_call_count:
            print(f"[Sub-calls: {step.sub_call_count}]", file=sys.stderr)

    print("-" * 60, file=sys.stderr)
    print(
        f"[Demo] Finished — terminated: {result.terminated}, "
        f"total sub-calls: {result.total_sub_calls}",
        file=sys.stderr,
    )
    print("\n=== FINAL ANSWER ===\n")
    print(result.answer)


if __name__ == "__main__":
    main()
