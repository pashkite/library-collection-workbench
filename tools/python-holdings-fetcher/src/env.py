from __future__ import annotations

import os
import re
from pathlib import Path

_LOADED = False


def _parse_value(raw_value: str) -> str:
    value = raw_value.strip()
    if not value:
        return ""

    quote = value[0]
    if quote in {"'", '"'} and value.endswith(quote):
        value = value[1:-1]
        if quote == '"':
            return (
                value.replace("\\n", "\n")
                .replace("\\r", "\r")
                .replace("\\t", "\t")
                .replace('\\"', '"')
                .replace("\\\\", "\\")
            )
        return value

    comment = re.search(r"\s+#", value)
    if comment:
        value = value[: comment.start()].strip()
    return value


def find_dotenv(start: Path | None = None) -> Path | None:
    current = (start or Path.cwd()).resolve()
    if current.is_file():
        current = current.parent

    for directory in (current, *current.parents):
        candidate = directory / ".env"
        if candidate.exists():
            return candidate
        if (directory / ".git").exists() or (directory / "package.json").exists():
            break
    return None


def load_dotenv(start: Path | None = None) -> Path | None:
    global _LOADED
    if _LOADED:
        return None
    _LOADED = True

    env_path = find_dotenv(start)
    if not env_path:
        return None

    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        match = re.match(r"^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$", line)
        if not match:
            continue
        key, raw_value = match.groups()
        os.environ.setdefault(key, _parse_value(raw_value))
    return env_path


def env_value(*names: str) -> str:
    load_dotenv()
    for name in names:
        value = os.environ.get(name, "").strip()
        if value:
            return value
    return ""
