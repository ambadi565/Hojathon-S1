"""Configuration settings for the RLM harness.

Uses pydantic BaseSettings to load values from environment variables and .env files.
"""

from __future__ import annotations

from pathlib import Path

from dotenv import load_dotenv
from pydantic import Field
from pydantic_settings import BaseSettings

# Load .env from the src/ directory (or wherever the process is started)
_env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path=_env_path if _env_path.exists() else None)


class Settings(BaseSettings):
    """RLM configuration settings.

    Attributes:
        ROOT_MODEL: Model ID for the root orchestrator.
        WORKER_MODEL: Model ID for the sub-call worker.
        MAX_ITERATIONS: Maximum number of root-model turns in a single run.
        STDOUT_TRUNCATION_LIMIT: Max characters of REPL stdout shown to the root model per turn.
        PREVIEW_LIMIT: Number of characters from the context shown as a preview in the system prompt.
        OPENAI_API_KEY: OpenAI API key loaded from the environment.
    """

    ROOT_MODEL: str = "gpt-4o"
    WORKER_MODEL: str = "gpt-4o-mini"
    MAX_ITERATIONS: int = 25
    STDOUT_TRUNCATION_LIMIT: int = 2000
    PREVIEW_LIMIT: int = 500
    OPENAI_API_KEY: str = Field(default="")

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}
