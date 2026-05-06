from __future__ import annotations

import json
import shutil
from datetime import datetime
from pathlib import Path

from openpyxl import Workbook

from .dedupe import dedupe_holdings
from .normalizer import DEDUPE_STRATEGY, validation_counts

JSON_FIELDS = [
    "id",
    "dedupeKey",
    "libCode",
    "libraryName",
    "title",
    "author",
    "publisher",
    "publicationYear",
    "isbn",
    "kdc",
    "callNumber",
    "shelfName",
    "registeredAt",
    "registrationNumber",
]

EXCEL_HEADERS = [
    "도서명",
    "저자",
    "출판사",
    "출판연도",
    "ISBN",
    "KDC",
    "청구기호",
    "배가명",
    "등록일",
    "등록번호",
    "중복키",
]


def public_rows(rows: list[dict]) -> list[dict]:
    return [{field: row.get(field, "") for field in JSON_FIELDS} for row in rows]


def build_meta(rows: list[dict], meta: dict, duplicate_skipped_count: int, lookback_days: int) -> dict:
    counts = validation_counts(rows)
    total_duplicate_skipped = int(meta.get("duplicateSkippedCount") or 0) + duplicate_skipped_count
    last_registration_number = ""
    for row in reversed(rows):
        if row.get("registrationNumber"):
            last_registration_number = str(row["registrationNumber"])
            break

    return {
        **meta,
        "totalCount": len(rows),
        "addedCount": len(rows) if meta.get("syncMode") == "full" else meta.get("addedCount", 0),
        "dailyLookbackDays": lookback_days,
        "duplicateSkippedCount": total_duplicate_skipped,
        "collectedCountAfterDedupe": len(rows),
        "registrationNumberAvailable": bool(last_registration_number),
        "lastRegistrationNumber": last_registration_number,
        "dedupeStrategy": DEDUPE_STRATEGY,
        **counts,
    }


def validate_dataset(rows: list[dict], meta: dict) -> None:
    if not rows:
        raise ValueError("저장할 소장자료가 없습니다.")
    if not isinstance(meta, dict):
        raise ValueError("meta 정보가 올바르지 않습니다.")
    missing_title = sum(1 for row in rows if not row.get("title"))
    if missing_title == len(rows):
        raise ValueError("모든 행에 도서명이 없어 저장을 중단합니다.")
    for index, row in enumerate(rows[:20]):
        if not row.get("dedupeKey"):
            raise ValueError(f"{index + 1}번째 행에 dedupeKey가 없습니다.")


def write_excel(rows: list[dict], target: Path) -> None:
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "소장목록"
    sheet.append(EXCEL_HEADERS)
    for row in rows:
        sheet.append(
            [
                row.get("title", ""),
                row.get("author", ""),
                row.get("publisher", ""),
                row.get("publicationYear", ""),
                row.get("isbn", ""),
                row.get("kdc", ""),
                row.get("callNumber", ""),
                row.get("shelfName", ""),
                row.get("registeredAt", ""),
                row.get("registrationNumber", ""),
                row.get("dedupeKey", ""),
            ]
        )
    workbook.save(target)


def save_dataset(output_dir: Path, rows: list[dict], meta: dict, lookback_days: int) -> dict:
    output_dir.mkdir(parents=True, exist_ok=True)
    deduped, skipped = dedupe_holdings(rows)
    next_meta = build_meta(deduped, meta, skipped, lookback_days)
    validate_dataset(deduped, next_meta)

    latest_tmp = output_dir / "holdings.latest.tmp.json"
    meta_tmp = output_dir / "holdings.meta.tmp.json"
    latest_path = output_dir / "holdings.latest.json"
    meta_path = output_dir / "holdings.meta.json"
    excel_path = output_dir / "holdings.xlsx"

    latest_tmp.write_text(json.dumps(public_rows(deduped), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    meta_tmp.write_text(json.dumps(next_meta, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    validate_dataset(json.loads(latest_tmp.read_text(encoding="utf-8")), json.loads(meta_tmp.read_text(encoding="utf-8")))

    backup_dir = output_dir / "backup" / datetime.now().strftime("%Y%m%d-%H%M%S")
    backup_dir.mkdir(parents=True, exist_ok=True)
    for path in (latest_path, meta_path, excel_path):
        if path.exists():
            shutil.copy2(path, backup_dir / path.name)

    latest_tmp.replace(latest_path)
    meta_tmp.replace(meta_path)
    write_excel(deduped, excel_path)

    return {
        "rows": deduped,
        "meta": next_meta,
        "duplicateSkippedCount": skipped,
        "latestPath": latest_path,
        "metaPath": meta_path,
        "excelPath": excel_path,
        "backupDir": backup_dir,
    }


def save_excel_only(output_dir: Path, rows: list[dict]) -> Path:
    output_dir.mkdir(parents=True, exist_ok=True)
    excel_path = output_dir / "holdings.xlsx"
    write_excel(rows, excel_path)
    return excel_path
