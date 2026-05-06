from __future__ import annotations

import json
import subprocess
from datetime import datetime
from pathlib import Path

from .storage import save_dataset


def validate_repo(repo_dir: Path) -> None:
    required = [repo_dir / "package.json", repo_dir / "vite.config.ts", repo_dir / "public" / "data"]
    missing = [str(path) for path in required if not path.exists()]
    if missing:
        raise ValueError("library-collection-workbench 저장소로 보이지 않습니다. 누락: " + ", ".join(missing))


def read_count(path: Path) -> int:
    if not path.exists():
        return 0
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return 0
    return len(value) if isinstance(value, list) else 0


def preview_repo_apply(repo_dir: Path, rows: list[dict], meta: dict) -> dict:
    validate_repo(repo_dir)
    data_dir = repo_dir / "public" / "data"
    old_count = read_count(data_dir / "holdings.latest.json")
    new_count = len(rows)
    return {
        "oldCount": old_count,
        "newCount": new_count,
        "addedCount": max(0, new_count - old_count),
        "duplicateSkippedCount": meta.get("duplicateSkippedCount", 0),
        "dataDir": data_dir,
    }


def apply_to_repo(repo_dir: Path, rows: list[dict], meta: dict, lookback_days: int) -> dict:
    validate_repo(repo_dir)
    data_dir = repo_dir / "public" / "data"
    return save_dataset(data_dir, rows, meta, lookback_days)


def run_git(repo_dir: Path, args: list[str]) -> str:
    result = subprocess.run(
        ["git", *args],
        cwd=repo_dir,
        check=False,
        text=True,
        capture_output=True,
    )
    output = "\n".join(part for part in (result.stdout.strip(), result.stderr.strip()) if part)
    if result.returncode != 0:
        raise RuntimeError(output or f"git {' '.join(args)} 명령이 실패했습니다.")
    return output


def commit_and_push(repo_dir: Path) -> list[str]:
    validate_repo(repo_dir)
    date_text = datetime.now().strftime("%Y-%m-%d")
    outputs = [
        run_git(repo_dir, ["status", "--short"]),
        run_git(repo_dir, ["add", "public/data/holdings.latest.json", "public/data/holdings.meta.json"]),
    ]
    status_after_add = run_git(repo_dir, ["status", "--short"])
    outputs.append(status_after_add)
    if not status_after_add.strip():
        outputs.append("커밋할 변경사항이 없습니다.")
        return outputs
    outputs.append(run_git(repo_dir, ["commit", "-m", f"Update holdings data from Python GUI {date_text}"]))
    outputs.append(run_git(repo_dir, ["push", "origin", "main"]))
    return outputs
