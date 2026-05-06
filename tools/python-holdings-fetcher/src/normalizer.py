from __future__ import annotations

import re
import unicodedata
from typing import Any

DEDUPE_STRATEGY = (
    "registrationNumber > isbn+callNumber+registeredAt+title > "
    "isbn+title+author+publisher > text fallback"
)

REGISTRATION_FIELD_CANDIDATES = (
    "registrationNumber",
    "regNo",
    "reg_no",
    "accessionNo",
    "accession_no",
    "controlNo",
    "등록번호",
)


def normalize_text(value: Any) -> str:
    text = unicodedata.normalize("NFKC", str(value or "")).strip().lower()
    return re.sub(r"\s+", " ", text)


def normalize_compact(value: Any) -> str:
    return re.sub(r"[\s\-_:./]", "", normalize_text(value))


def normalize_isbn(value: Any) -> str:
    return re.sub(r"[^0-9Xx]", "", str(value or "")).upper()


def as_list(value: Any) -> list:
    if value is None:
        return []
    if isinstance(value, list):
        return value
    return [value]


def read_string(value: Any) -> str:
    return str(value or "").strip()


def find_registration_number(doc: dict, call_number: dict | None = None) -> str:
    for source in (doc, call_number or {}):
        for key in REGISTRATION_FIELD_CANDIDATES:
            value = source.get(key)
            if value is not None and str(value).strip():
                return str(value).strip()
    return ""


def registration_candidate_paths(payload: Any) -> list[str]:
    paths: list[str] = []

    def walk(value: Any, path: str) -> None:
        if isinstance(value, dict):
            for key, child in value.items():
                child_path = f"{path}.{key}" if path else str(key)
                if key in REGISTRATION_FIELD_CANDIDATES and str(child or "").strip():
                    paths.append(child_path)
                walk(child, child_path)
        elif isinstance(value, list):
            for index, child in enumerate(value):
                walk(child, f"{path}[{index}]")

    walk(payload, "")
    return paths


def make_dedupe_key(row: dict) -> str:
    lib_code = read_string(row.get("libCode"))
    title = normalize_compact(row.get("title"))
    author = normalize_compact(row.get("author"))
    publisher = normalize_compact(row.get("publisher"))
    isbn = normalize_isbn(row.get("isbn"))
    call_number = normalize_compact(row.get("callNumber"))
    registered_at = read_string(row.get("registeredAt"))
    publication_year = read_string(row.get("publicationYear"))
    registration_number = read_string(row.get("registrationNumber"))

    if registration_number:
        return f"reg:{lib_code}:{registration_number}"
    if isbn and call_number:
        return f"holding:{lib_code}:{isbn}:{call_number}:{registered_at}:{title}"
    if isbn:
        return f"book:{lib_code}:{isbn}:{title}:{author}:{publisher}"
    return f"text:{lib_code}:{title}:{author}:{publisher}:{publication_year}:{call_number}"


def extract_docs(payload: dict) -> list[dict]:
    docs = payload.get("response", {}).get("docs", {})
    if isinstance(docs, list):
        result: list[dict] = []
        for entry in docs:
            result.extend(as_list(entry.get("doc") if isinstance(entry, dict) else entry))
        return [item for item in result if isinstance(item, dict)]
    doc_value = docs.get("doc") if isinstance(docs, dict) else None
    return [item for item in as_list(doc_value) if isinstance(item, dict)]


def first_call_number(doc: dict) -> dict:
    call_numbers = doc.get("callNumbers", {})
    call_number = call_numbers.get("callNumber") if isinstance(call_numbers, dict) else None
    values = [item for item in as_list(call_number) if isinstance(item, dict)]
    return values[0] if values else {}


def standardize_doc(doc: dict, index: int, lib_code: str, library_name: str) -> dict:
    call_number = first_call_number(doc)
    row = {
        "libCode": lib_code,
        "libraryName": library_name,
        "title": read_string(doc.get("bookname")),
        "author": read_string(doc.get("authors")),
        "publisher": read_string(doc.get("publisher")),
        "publicationYear": read_string(doc.get("publication_year")),
        "isbn": read_string(doc.get("isbn13")),
        "kdc": read_string(doc.get("class_no")),
        "callNumber": read_string(call_number.get("call_no")),
        "shelfName": read_string(call_number.get("shelf_loc_name")),
        "registeredAt": read_string(call_number.get("reg_date")),
        "registrationNumber": find_registration_number(doc, call_number),
    }
    dedupe_key = make_dedupe_key(row)
    return {"id": f"{dedupe_key}:{index}", "dedupeKey": dedupe_key, **row}


def validation_counts(rows: list[dict]) -> dict:
    return {
        "isbnMissingCount": sum(1 for row in rows if not row.get("isbn")),
        "kdcMissingCount": sum(1 for row in rows if not row.get("kdc")),
        "titleMissingCount": sum(1 for row in rows if not row.get("title")),
        "callNumberMissingCount": sum(1 for row in rows if not row.get("callNumber")),
        "registeredAtMissingCount": sum(1 for row in rows if not row.get("registeredAt")),
    }
