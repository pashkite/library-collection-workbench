from __future__ import annotations

import json
import math
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from threading import Event
from typing import Any, Callable

import requests

from .normalizer import (
    REGISTRATION_FIELD_CANDIDATES,
    extract_docs,
    first_call_number,
    registration_candidate_paths,
    standardize_doc,
)

API_URL = "https://data4library.kr/api/itemSrch"
IP_URL = "https://api.ipify.org?format=json"
MAX_PAGE_SIZE = 300


class Data4LibraryClient:
    def __init__(self, auth_key: str, lib_code: str, library_name: str, timeout: int = 30) -> None:
        self.auth_key = auth_key.strip()
        self.lib_code = lib_code.strip()
        self.library_name = library_name.strip()
        self.timeout = timeout
        self.api_call_count = 0

    def _request(self, params: dict, retries: int = 3) -> dict:
        if not self.auth_key:
            raise ValueError("정보나루 API 인증키를 입력하세요.")
        if not self.lib_code:
            raise ValueError("도서관 코드를 입력하세요.")

        safe_params = {**params, "authKey": self.auth_key, "libCode": self.lib_code, "format": "json"}
        last_error: Exception | None = None
        for attempt in range(1, retries + 1):
            try:
                response = requests.get(API_URL, params=safe_params, timeout=self.timeout)
                self.api_call_count += 1
                response.raise_for_status()
                return response.json()
            except Exception as error:  # requests raises several subclasses.
                last_error = error
                if attempt < retries:
                    time.sleep(0.8 * attempt)
        raise RuntimeError(f"정보나루 API 호출에 실패했습니다. {last_error}") from last_error

    @staticmethod
    def external_ip() -> str:
        response = requests.get(IP_URL, timeout=10)
        response.raise_for_status()
        return str(response.json().get("ip", "확인 실패"))

    @staticmethod
    def _scrub_auth_key(value: Any) -> Any:
        if isinstance(value, dict):
            return {
                key: "***redacted***" if key.lower() == "authkey" else Data4LibraryClient._scrub_auth_key(child)
                for key, child in value.items()
            }
        if isinstance(value, list):
            return [Data4LibraryClient._scrub_auth_key(child) for child in value]
        return value

    def debug_item_search(self, output_dir: Path, log: Callable[[str], None]) -> Path:
        payload = self._request({"type": "ALL", "pageNo": "1", "pageSize": "3"})
        output_dir.mkdir(parents=True, exist_ok=True)
        raw_path = output_dir / "debug_raw_itemSrch.json"
        raw_text = json.dumps(self._scrub_auth_key(payload), ensure_ascii=False, indent=2)
        if self.auth_key:
            raw_text = raw_text.replace(self.auth_key, "***redacted***")
        raw_path.write_text(raw_text + "\n", encoding="utf-8")

        docs = extract_docs(payload)
        if not docs:
            log("docs.doc 항목을 찾지 못했습니다.")
            return raw_path

        first = docs[0]
        log("첫 번째 docs.doc 필드:")
        for key in sorted(first.keys()):
            log(f"  - {key}")

        call_number = first_call_number(first)
        if call_number:
            log("callNumbers.callNumber 내부 필드:")
            for key in sorted(call_number.keys()):
                log(f"  - {key}")

        found = registration_candidate_paths(first)
        if found:
            log(f"등록번호 후보 필드 발견: {', '.join(found)}")
        else:
            log(
                "등록번호 필드가 확인되지 않아 fallback dedupeKey를 사용합니다. "
                f"탐색 필드: {', '.join(REGISTRATION_FIELD_CANDIDATES)}"
            )
        return raw_path

    def fetch_all(
        self,
        page_size: int,
        max_pages: int,
        stop_event: Event,
        progress: Callable[[dict], None],
    ) -> tuple[list[dict], dict]:
        self.api_call_count = 0
        page_size = max(1, int(page_size))
        max_pages = max(1, int(max_pages))
        if page_size > MAX_PAGE_SIZE:
            raise ValueError(f"pageSize는 {MAX_PAGE_SIZE} 이하로 입력하세요. 권장값은 300입니다.")

        first = self._request({"type": "ALL", "pageNo": "1", "pageSize": str(page_size)})
        expected_total = int(first.get("response", {}).get("numFound") or len(extract_docs(first)))
        total_pages = max(1, math.ceil(expected_total / page_size))
        if total_pages > max_pages:
            raise RuntimeError(
                f"전체 예상 페이지 {total_pages}쪽이 maxPages {max_pages}쪽보다 큽니다. "
                "maxPages를 늘린 뒤 다시 실행하세요."
            )

        rows: list[dict] = []
        docs = extract_docs(first)
        rows.extend(
            standardize_doc(doc, index, self.lib_code, self.library_name) for index, doc in enumerate(docs)
        )
        progress(
            {
                "stage": "전체 수집 중",
                "page": 1,
                "totalPages": total_pages,
                "apiCalls": self.api_call_count,
                "collected": len(rows),
                "expectedTotal": expected_total,
            }
        )

        for page_no in range(2, total_pages + 1):
            if stop_event.is_set():
                raise RuntimeError("사용자가 수집을 중지했습니다. 기존 파일은 변경하지 않습니다.")
            payload = self._request({"type": "ALL", "pageNo": str(page_no), "pageSize": str(page_size)})
            offset = len(rows)
            page_docs = extract_docs(payload)
            rows.extend(
                standardize_doc(doc, offset + index, self.lib_code, self.library_name)
                for index, doc in enumerate(page_docs)
            )
            progress(
                {
                    "stage": "전체 수집 중",
                    "page": page_no,
                    "totalPages": total_pages,
                    "apiCalls": self.api_call_count,
                    "collected": len(rows),
                    "expectedTotal": expected_total,
                }
            )

        if not rows:
            raise RuntimeError("수집 건수가 0건이라 저장하지 않습니다.")

        now = datetime.now(timezone.utc).isoformat()
        today = (datetime.now(timezone.utc) + timedelta(hours=9)).date().isoformat()
        meta = {
            "baseDate": today,
            "lastUpdatedAt": now,
            "dailyCheckAt": None,
            "totalCount": len(rows),
            "libraryCode": self.lib_code,
            "libraryName": self.library_name,
            "status": "ready",
            "source": "data4library",
            "syncMode": "full",
            "lastFullSyncAt": now,
            "lastDailySyncAt": None,
            "addedCount": len(rows),
            "removedCount": 0,
            "apiCallCount": self.api_call_count,
            "expectedTotalFromApi": expected_total,
            "collectedCountBeforeDedupe": len(rows),
            "message": "Python GUI에서 전체 소장자료를 수집했습니다.",
        }
        return rows, meta
