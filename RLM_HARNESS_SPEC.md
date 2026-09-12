# Minimal Recursive Language Model (RLM) Harness

## Project Specification

Build a complete, standalone Python implementation of a Recursive Language Model (RLM) inference engine based on [arXiv:2512.24601](https://arxiv.org/abs/2512.24601). The engine treats arbitrarily long user prompts as external state stored inside a persistent REPL environment rather than feeding them directly into the root LLM's context window.

## 1. Technology Stack

- **Language and runtime:** Python 3.11+
- **LLM provider:** Official `openai` Python SDK (v1.0+)
- **Root orchestrator:** `gpt-4o`
- **Sub-call worker:** `gpt-4o-mini`
- **Configuration and environment:** `python-dotenv` for `OPENAI_API_KEY`; `pydantic` for configuration settings
- **CLI framework:** `argparse` or `typer`
- **Execution and sandboxing:** Native in-process Python `exec()` with a persistent `globals_dict`, `io.StringIO` stdout capture, and output truncation

## 2. Required File Structure

```text
rlm/
├── __init__.py
├── config.py           # Model IDs, token budgets, truncation thresholds
├── repl.py             # Persistent REPL environment with stdout redirect
├── client.py           # OpenAI API client wrapper for root and worker calls
├── agent.py            # Main RLM orchestration loop (Algorithm 1)
├── prompts.py          # System prompt template for the root model
└── cli.py              # Command-line interface entry point
tests/
├── test_repl.py        # Unit tests for persistent REPL state and stdout capture
└── test_agent.py       # Integration tests with mock and live sub-calls
example.py              # Demo script demonstrating a 200k+ character context query
requirements.txt        # openai, python-dotenv, pydantic, typer
.env.example            # OPENAI_API_KEY=
```

## 3. Component Specifications

### `config.py`

Define a `Settings` class with these defaults:

```python
ROOT_MODEL: str = "gpt-4o"
WORKER_MODEL: str = "gpt-4o-mini"
MAX_ITERATIONS: int = 25
STDOUT_TRUNCATION_LIMIT: int = 2000
PREVIEW_LIMIT: int = 500
```

`MAX_ITERATIONS` is the maximum number of root-model turns. `STDOUT_TRUNCATION_LIMIT` is the number of stdout characters shown to the root model per turn. `PREVIEW_LIMIT` controls the initial context preview.

### `repl.py`

Implement `PersistentREPL`.

- Maintain persistent state in `self.env_globals: dict = {}`.
- Pre-populate the namespace with safe standard modules: `re`, `math`, `json`, and `collections`.
- `set_context(context_str: str) -> None` stores the full input as `context` in `self.env_globals`.
- Inject a callable `llm_query(prompt: str) -> str` into `self.env_globals`.
- `execute(code: str) -> tuple[str, bool, Optional[Exception]]` must:
  - Capture `sys.stdout` with `contextlib.redirect_stdout(io.StringIO())`.
  - Execute code with `exec(code, self.env_globals)`.
  - Truncate stdout to `STDOUT_TRUNCATION_LIMIT` and append `[Truncated: output exceeded limit]` when output is trimmed.
  - Catch syntax errors and runtime exceptions without crashing the host process.
  - Return standard tracebacks in the captured output for failed execution.

### `client.py`

Implement `LLMClient` using the official OpenAI SDK.

- `call_root(messages: list[dict]) -> str` synchronously calls the root model, `gpt-4o`.
- `call_worker(prompt: str) -> str` synchronously calls the worker model, `gpt-4o-mini`.
- Load `OPENAI_API_KEY` from the environment through the project configuration.

### `prompts.py`

Provide a root-model system prompt that enforces RLM behavior. It must:

- State: `You have an external variable named context containing {total_chars} characters. You CANNOT see it directly.`
- Include a preview using `context[:500]`.
- Instruct the model to generate Python code inside `repl ...` blocks.
- Emphasize batching and querying: use `llm_query(prompt)` inside loops or on specific slices of `context` to perform semantic tasks.
- Define the termination contract:
  - Direct answer: write `FINAL(your answer here)` outside code.
  - Answer from a REPL variable: write `FINAL_VAR(variable_name)` outside code.

### `agent.py`

Implement `RLMRunner` according to Algorithm 1:

1. Initialize `PersistentREPL`, inject `llm_query` wired to `LLMClient.call_worker`, and set `context = prompt_text`.
2. Construct initial message history containing metadata such as length, type, and a snippet preview.
3. Loop for at most `MAX_ITERATIONS`:
   1. Call `LLMClient.call_root(history)`.
   2. Parse termination tags:
      - If `FINAL(text)` is present, extract and return `text`.
      - If `FINAL_VAR(var_name)` is present, retrieve the variable from `repl.env_globals` and return `str(value)`.
   3. Extract all code from `repl ...` blocks, with `python ...` blocks as a fallback.
   4. When code exists, execute it in `PersistentREPL`.
   5. Append execution stdout or traceback to the root model's history as an environment observation turn.
   6. When there is neither code nor a termination tag, prompt the model to take a REPL action or conclude.
4. Ensure multiline `FINAL` and `FINAL_VAR` handling is clean and deterministic.

The runner should retain enough trajectory information for the CLI to report executed code, stdout previews, and sub-call counts.

### `cli.py`

Implement a CLI with `argparse` or `typer` supporting:

```bash
python -m rlm.cli \
  --file path/to/large_document.txt \
  --query "Find all mentions of X and summarize their impact"
```

- Read the document from `--file`.
- Run the RLM query.
- Write trajectory steps to `stderr`, including code executed, stdout previews, and sub-call count.
- Write only the final answer to `stdout`.

### `example.py`

Provide a demo using a synthetic document of at least 150,000 characters, with facts scattered throughout the context. The example should demonstrate a query over the large context and document how to provide `OPENAI_API_KEY`.

## 4. Tests and Verification

### REPL tests

`tests/test_repl.py` must verify:

- State persists across multiple `execute()` calls.
- stdout is captured and truncated at the configured limit.
- syntax and runtime errors return tracebacks without crashing the test process.
- `llm_query` can be invoked inside loops and returns mocked worker responses.
- The `context` variable is available after initialization.

### Agent tests

`tests/test_agent.py` must verify with mocked root and worker calls:

- `FINAL(text)` returns direct text.
- `FINAL_VAR(variable_name)` returns the value created in the REPL.
- Multiline termination content is parsed correctly.
- REPL code is extracted and executed.
- Environment observations are fed back into the root history.
- A no-action root response receives a follow-up instruction.
- The loop stops at `MAX_ITERATIONS` when no termination tag is produced.

Live sub-call tests may be included separately, but must not require an API key for the default test suite.

## 5. Dependencies and Environment

`requirements.txt` must include:

```text
openai
python-dotenv
pydantic
pytest
```

The `.env.example` file must contain:

```dotenv
OPENAI_API_KEY=
```

Never commit a real API key or other secret.

## 6. Acceptance Criteria

The implementation is complete when:

- A Python 3.11+ environment can install the declared dependencies and import the `rlm` package.
- A long prompt is stored in the persistent REPL rather than inserted wholesale into the root model's prompt.
- The root model can inspect slices or derived values through generated REPL code and worker calls.
- REPL state persists between turns.
- stdout and tracebacks are safely returned as observations with truncation applied.
- Both final-answer contracts work for direct text and REPL variables, including multiline content.
- The CLI separates trajectory diagnostics on `stderr` from the final answer on `stdout`.
- The automated tests pass without requiring live API access.
