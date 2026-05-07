from __future__ import annotations

import platform
import shutil
import subprocess
from pathlib import Path
from tkinter import font as tkfont

KOREAN_FONT_CANDIDATES = (
    "Malgun Gothic",
    "맑은 고딕",
    "Noto Sans CJK KR",
    "Noto Sans KR",
    "NanumGothic",
    "Nanum Gothic",
    "AppleGothic",
    "Gulim",
    "Batang",
)

WINDOWS_KOREAN_FONT_FILES = (
    (Path("/mnt/c/Windows/Fonts/malgun.ttf"), "Malgun Gothic"),
    (Path("/mnt/c/Windows/Fonts/gulim.ttc"), "Gulim"),
    (Path("/mnt/c/Windows/Fonts/batang.ttc"), "Batang"),
)


def _register_windows_font() -> str | None:
    if platform.system() != "Linux":
        return None

    for source, family in WINDOWS_KOREAN_FONT_FILES:
        if not source.exists():
            continue

        target_dir = Path.home() / ".local" / "share" / "fonts" / "library-collection-workbench"
        target_dir.mkdir(parents=True, exist_ok=True)
        target = target_dir / source.name
        if not target.exists():
            try:
                target.symlink_to(source)
            except OSError:
                shutil.copy2(source, target)

        subprocess.run(
            ["fc-cache", "-f", str(target_dir)],
            check=False,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        return family

    return None


def prepare_korean_font() -> str | None:
    return _register_windows_font()


def choose_korean_font(root) -> tuple[str, str]:
    families = {family.casefold(): family for family in tkfont.families(root)}
    for candidate in KOREAN_FONT_CANDIDATES:
        family = families.get(candidate.casefold())
        if family:
            return family, ""

    installed_family = _register_windows_font()
    if installed_family:
        families = {family.casefold(): family for family in tkfont.families(root)}
        family = families.get(installed_family.casefold())
        if family:
            return family, ""

    fallback = "Arial" if platform.system() == "Windows" else "DejaVu Sans"
    message = (
        "한글 글꼴을 찾지 못했습니다. WSL/Ubuntu에서는 "
        "sudo apt install fonts-noto-cjk 또는 fonts-nanum 설치를 권장합니다."
    )
    return fallback, message
