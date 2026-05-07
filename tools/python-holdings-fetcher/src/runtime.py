from __future__ import annotations

import importlib.util
import sys

REQUIRED_MODULES = {
    "tkinter": "python3-tk",
    "customtkinter": "customtkinter",
    "requests": "requests",
    "openpyxl": "openpyxl",
}


def missing_modules() -> list[str]:
    return [module for module in REQUIRED_MODULES if importlib.util.find_spec(module) is None]


def ensure_runtime() -> None:
    missing = missing_modules()
    if not missing:
        return

    print("Python GUI 실행에 필요한 모듈이 없습니다: " + ", ".join(missing), file=sys.stderr)
    if "tkinter" in missing:
        print("Ubuntu/WSL: sudo apt install python3-tk", file=sys.stderr)
    pip_missing = [module for module in missing if module != "tkinter"]
    if pip_missing:
        print("가상환경 활성화 후: python3 -m pip install -r requirements.txt", file=sys.stderr)
    print("이 환경은 python 명령이 없으므로 python3 명령을 사용하세요.", file=sys.stderr)
    raise SystemExit(1)
