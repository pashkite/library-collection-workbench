from __future__ import annotations

import os
import platform
import queue
import subprocess
import threading
from pathlib import Path
from tkinter import filedialog, messagebox

import customtkinter as ctk

from .api import Data4LibraryClient
from .dedupe import dedupe_holdings
from .git_ops import apply_to_repo, commit_and_push, preview_repo_apply, validate_repo
from .storage import save_dataset, save_excel_only


class HoldingsFetcherApp(ctk.CTk):
    def __init__(self) -> None:
        super().__init__()
        self.title("정보나루 소장자료 수집기")
        self.geometry("1180x780")
        self.minsize(1040, 680)

        ctk.set_appearance_mode("light")
        ctk.set_default_color_theme("blue")

        self.stop_event = threading.Event()
        self.events: queue.Queue[tuple[str, object]] = queue.Queue()
        self.last_rows: list[dict] = []
        self.last_meta: dict = {}
        self.last_saved: dict | None = None
        self.worker: threading.Thread | None = None

        self.auth_key = ctk.StringVar()
        self.lib_code = ctk.StringVar()
        self.library_name = ctk.StringVar(value="달성군립도서관")
        self.output_dir = ctk.StringVar(value=str(Path.cwd() / "output"))
        self.repo_dir = ctk.StringVar()
        self.page_size = ctk.StringVar(value="300")
        self.max_pages = ctk.StringVar(value="200")
        self.lookback_days = ctk.StringVar(value="7")

        self.status_vars = {
            "ip": ctk.StringVar(value="-"),
            "stage": ctk.StringVar(value="대기"),
            "page": ctk.StringVar(value="-"),
            "calls": ctk.StringVar(value="0"),
            "collected": ctk.StringVar(value="0"),
            "dedupe": ctk.StringVar(value="-"),
            "error": ctk.StringVar(value="-"),
        }

        self._build_ui()
        self.after(120, self._drain_events)

    def _build_ui(self) -> None:
        self.grid_columnconfigure(0, weight=0)
        self.grid_columnconfigure(1, weight=1)
        self.grid_rowconfigure(0, weight=1)

        left = ctk.CTkFrame(self, corner_radius=12)
        left.grid(row=0, column=0, sticky="nsw", padx=14, pady=14)
        left.grid_columnconfigure(1, weight=1)

        title = ctk.CTkLabel(left, text="수집 설정", font=ctk.CTkFont(size=20, weight="bold"))
        title.grid(row=0, column=0, columnspan=3, sticky="w", padx=16, pady=(16, 10))

        row = 1
        row = self._entry(left, row, "정보나루 API 인증키", self.auth_key, show="*")
        row = self._entry(left, row, "도서관 코드", self.lib_code)
        row = self._entry(left, row, "도서관 이름", self.library_name)
        row = self._path_entry(left, row, "저장 폴더", self.output_dir, "folder")
        row = self._path_entry(left, row, "로컬 Git 저장소", self.repo_dir, "folder")
        row = self._entry(left, row, "pageSize", self.page_size)
        row = self._entry(left, row, "maxPages", self.max_pages)
        row = self._entry(left, row, "최근 조회 기간", self.lookback_days)

        buttons = [
            ("외부 IP 확인", self.check_ip),
            ("API 응답 구조 확인", self.debug_api),
            ("전체 수집 시작", self.start_full_fetch),
            ("수집 중지", self.stop_fetch),
            ("JSON 저장", self.save_json),
            ("Excel 저장", self.save_excel),
            ("Git 반영 미리보기", self.preview_and_apply_repo),
            ("GitHub에 commit/push", self.commit_push),
            ("백업 열기", self.open_backup),
        ]
        for index, (text, command) in enumerate(buttons):
            button = ctk.CTkButton(left, text=text, command=command)
            button.grid(row=row + index, column=0, columnspan=3, sticky="ew", padx=16, pady=4)

        right = ctk.CTkFrame(self, corner_radius=12)
        right.grid(row=0, column=1, sticky="nsew", padx=(0, 14), pady=14)
        right.grid_columnconfigure(0, weight=1)
        right.grid_rowconfigure(2, weight=1)

        ctk.CTkLabel(right, text="상태", font=ctk.CTkFont(size=20, weight="bold")).grid(
            row=0, column=0, sticky="w", padx=16, pady=(16, 8)
        )

        status = ctk.CTkFrame(right, fg_color="#f3f6f8", corner_radius=10)
        status.grid(row=1, column=0, sticky="ew", padx=16, pady=(0, 12))
        for column in range(4):
            status.grid_columnconfigure(column, weight=1)

        self._status_card(status, 0, 0, "현재 외부 IP", self.status_vars["ip"])
        self._status_card(status, 0, 1, "현재 진행 단계", self.status_vars["stage"])
        self._status_card(status, 0, 2, "페이지", self.status_vars["page"])
        self._status_card(status, 0, 3, "API 호출 횟수", self.status_vars["calls"])
        self._status_card(status, 1, 0, "수집 건수", self.status_vars["collected"])
        self._status_card(status, 1, 1, "중복 제거 전/후", self.status_vars["dedupe"])
        self._status_card(status, 1, 2, "오류 메시지", self.status_vars["error"], columnspan=2)

        log_frame = ctk.CTkFrame(right, corner_radius=10)
        log_frame.grid(row=2, column=0, sticky="nsew", padx=16, pady=(0, 16))
        log_frame.grid_columnconfigure(0, weight=1)
        log_frame.grid_rowconfigure(1, weight=1)
        ctk.CTkLabel(log_frame, text="로그", font=ctk.CTkFont(size=15, weight="bold")).grid(
            row=0, column=0, sticky="w", padx=12, pady=(10, 4)
        )
        self.log_box = ctk.CTkTextbox(log_frame, wrap="word")
        self.log_box.grid(row=1, column=0, sticky="nsew", padx=12, pady=(0, 12))
        self.log("인증키는 로그와 저장 파일에 남기지 않습니다.")

    def _entry(self, parent: ctk.CTkFrame, row: int, label: str, variable: ctk.StringVar, show: str | None = None) -> int:
        ctk.CTkLabel(parent, text=label).grid(row=row, column=0, sticky="w", padx=16, pady=(6, 2))
        entry = ctk.CTkEntry(parent, textvariable=variable, show=show)
        entry.grid(row=row + 1, column=0, columnspan=3, sticky="ew", padx=16, pady=(0, 6))
        return row + 2

    def _path_entry(
        self,
        parent: ctk.CTkFrame,
        row: int,
        label: str,
        variable: ctk.StringVar,
        mode: str,
    ) -> int:
        ctk.CTkLabel(parent, text=label).grid(row=row, column=0, sticky="w", padx=16, pady=(6, 2))
        entry = ctk.CTkEntry(parent, textvariable=variable)
        entry.grid(row=row + 1, column=0, columnspan=2, sticky="ew", padx=(16, 6), pady=(0, 6))
        command = lambda: self._choose_path(variable, mode)
        ctk.CTkButton(parent, text="선택", width=64, command=command).grid(
            row=row + 1, column=2, sticky="ew", padx=(0, 16), pady=(0, 6)
        )
        return row + 2

    def _status_card(
        self,
        parent: ctk.CTkFrame,
        row: int,
        column: int,
        label: str,
        variable: ctk.StringVar,
        columnspan: int = 1,
    ) -> None:
        frame = ctk.CTkFrame(parent, fg_color="white", corner_radius=8)
        frame.grid(row=row, column=column, columnspan=columnspan, sticky="ew", padx=8, pady=8)
        ctk.CTkLabel(frame, text=label, text_color="#66707c").pack(anchor="w", padx=10, pady=(8, 0))
        ctk.CTkLabel(frame, textvariable=variable, font=ctk.CTkFont(size=14, weight="bold"), wraplength=380).pack(
            anchor="w", padx=10, pady=(2, 8)
        )

    def _choose_path(self, variable: ctk.StringVar, mode: str) -> None:
        if mode == "folder":
            selected = filedialog.askdirectory()
        else:
            selected = filedialog.askopenfilename()
        if selected:
            variable.set(selected)

    def log(self, message: str) -> None:
        self.log_box.insert("end", message + "\n")
        self.log_box.see("end")

    def _thread_log(self, message: str) -> None:
        self.events.put(("log", message))

    def _set_status(self, key: str, value: object) -> None:
        self.events.put(("status", (key, str(value))))

    def _drain_events(self) -> None:
        while True:
            try:
                kind, payload = self.events.get_nowait()
            except queue.Empty:
                break
            if kind == "log":
                self.log(str(payload))
            elif kind == "status":
                key, value = payload  # type: ignore[misc]
                self.status_vars[str(key)].set(str(value))
            elif kind == "done":
                self.status_vars["stage"].set("완료")
            elif kind == "error":
                self.status_vars["error"].set(str(payload))
                self.log(str(payload))
                messagebox.showerror("오류", str(payload))
            elif kind == "warning":
                messagebox.showwarning("확인 필요", str(payload))
        self.after(120, self._drain_events)

    def _client(self) -> Data4LibraryClient:
        return Data4LibraryClient(self.auth_key.get(), self.lib_code.get(), self.library_name.get())

    def _int_value(self, variable: ctk.StringVar, label: str) -> int:
        try:
            value = int(variable.get())
        except ValueError as error:
            raise ValueError(f"{label}에는 숫자를 입력하세요.") from error
        if value <= 0:
            raise ValueError(f"{label}에는 1 이상의 숫자를 입력하세요.")
        return value

    def _run_worker(self, target) -> None:
        if self.worker and self.worker.is_alive():
            messagebox.showinfo("실행 중", "이미 실행 중인 작업이 있습니다.")
            return
        self.status_vars["error"].set("-")
        self.worker = threading.Thread(target=target, daemon=True)
        self.worker.start()

    def check_ip(self) -> None:
        def worker() -> None:
            try:
                self._set_status("stage", "외부 IP 확인 중")
                ip = Data4LibraryClient.external_ip()
                self._set_status("ip", ip)
                self._thread_log(f"현재 외부 IP: {ip}")
                self.events.put(("done", None))
            except Exception as error:
                self.events.put(("error", f"외부 IP 확인 실패: {error}"))

        self._run_worker(worker)

    def debug_api(self) -> None:
        def worker() -> None:
            try:
                self._set_status("stage", "API 응답 구조 확인 중")
                path = self._client().debug_item_search(Path(self.output_dir.get()), self._thread_log)
                self._thread_log(f"원본 응답 저장: {path}")
                self.events.put(("done", None))
            except Exception as error:
                self.events.put(("error", f"API 응답 구조 확인 실패: {error}"))

        self._run_worker(worker)

    def start_full_fetch(self) -> None:
        def worker() -> None:
            try:
                self.stop_event.clear()
                page_size = self._int_value(self.page_size, "pageSize")
                max_pages = self._int_value(self.max_pages, "maxPages")
                lookback_days = self._int_value(self.lookback_days, "최근 조회 기간")
                client = self._client()

                def progress(payload: dict) -> None:
                    page_text = f"{payload.get('page')} / {payload.get('totalPages')}"
                    self._set_status("stage", payload.get("stage", "수집 중"))
                    self._set_status("page", page_text)
                    self._set_status("calls", payload.get("apiCalls", 0))
                    self._set_status("collected", payload.get("collected", 0))
                    self._thread_log(
                        f"{page_text}쪽 처리, 수집 {payload.get('collected')}건, API {payload.get('apiCalls')}회"
                    )

                rows, meta = client.fetch_all(page_size, max_pages, self.stop_event, progress)
                deduped, skipped = dedupe_holdings(rows)
                self.last_rows = deduped
                self.last_meta = {
                    **meta,
                    "dailyLookbackDays": lookback_days,
                    "duplicateSkippedCount": skipped,
                    "collectedCountBeforeDedupe": len(rows),
                    "collectedCountAfterDedupe": len(deduped),
                }
                expected = int(meta.get("expectedTotalFromApi") or 0)
                if expected and abs(expected - len(rows)) > page_size:
                    self.events.put(
                        (
                            "warning",
                            f"API 예상 건수 {expected}건과 실제 수집 {len(rows)}건 차이가 큽니다. 저장 전 데이터를 확인하세요.",
                        )
                    )
                self._set_status("dedupe", f"{len(rows)} / {len(deduped)}")
                self._set_status("collected", len(deduped))
                self._thread_log(f"전체 수집 완료: 중복 제거 전 {len(rows)}건, 후 {len(deduped)}건, 제외 {skipped}건")
                self.events.put(("done", None))
            except Exception as error:
                self.events.put(("error", f"전체 수집 실패: {error}"))

        self._run_worker(worker)

    def stop_fetch(self) -> None:
        self.stop_event.set()
        self.status_vars["stage"].set("중지 요청")
        self.log("수집 중지를 요청했습니다. 진행 중인 API 호출이 끝나면 중단됩니다.")

    def _require_rows(self) -> None:
        if not self.last_rows:
            raise ValueError("먼저 전체 수집을 완료하세요.")

    def save_json(self) -> None:
        try:
            self._require_rows()
            result = save_dataset(
                Path(self.output_dir.get()),
                self.last_rows,
                self.last_meta,
                self._int_value(self.lookback_days, "최근 조회 기간"),
            )
            self.last_saved = result
            self.last_rows = result["rows"]
            self.last_meta = result["meta"]
            self.status_vars["dedupe"].set(
                f"{self.last_meta.get('collectedCountBeforeDedupe')} / {self.last_meta.get('collectedCountAfterDedupe')}"
            )
            self.log(f"JSON 저장 완료: {result['latestPath']}")
            self.log(f"Excel 저장 완료: {result['excelPath']}")
            self.log(f"백업 폴더: {result['backupDir']}")
        except Exception as error:
            messagebox.showerror("저장 실패", str(error))
            self.status_vars["error"].set(str(error))

    def save_excel(self) -> None:
        try:
            self._require_rows()
            rows, _ = dedupe_holdings(self.last_rows)
            path = save_excel_only(Path(self.output_dir.get()), rows)
            self.log(f"Excel 저장 완료: {path}")
        except Exception as error:
            messagebox.showerror("Excel 저장 실패", str(error))
            self.status_vars["error"].set(str(error))

    def preview_and_apply_repo(self) -> None:
        try:
            self._require_rows()
            repo = Path(self.repo_dir.get())
            validate_repo(repo)
            preview = preview_repo_apply(repo, self.last_rows, self.last_meta)
            message = (
                f"기존 건수: {preview['oldCount']:,}건\n"
                f"신규 건수: {preview['newCount']:,}건\n"
                f"추정 addedCount: {preview['addedCount']:,}건\n"
                f"duplicateSkippedCount: {preview['duplicateSkippedCount']:,}건\n\n"
                "이 내용을 로컬 Git 저장소 public/data에 반영할까요?"
            )
            self.log("Git 반영 미리보기")
            self.log(message.replace("\n", " | "))
            if not messagebox.askyesno("Git 저장소 반영 확인", message):
                return
            result = apply_to_repo(
                repo,
                self.last_rows,
                self.last_meta,
                self._int_value(self.lookback_days, "최근 조회 기간"),
            )
            self.log(f"Git 저장소 반영 완료: {result['latestPath']}")
            self.log(f"백업 폴더: {result['backupDir']}")
        except Exception as error:
            messagebox.showerror("Git 저장소 반영 실패", str(error))
            self.status_vars["error"].set(str(error))

    def commit_push(self) -> None:
        def worker() -> None:
            try:
                repo = Path(self.repo_dir.get())
                self._set_status("stage", "git commit/push 실행 중")
                for output in commit_and_push(repo):
                    if output.strip():
                        self._thread_log(output)
                self.events.put(("done", None))
            except Exception as error:
                self.events.put(("error", f"git 명령 실패: {error}"))

        self._run_worker(worker)

    def open_backup(self) -> None:
        backup_dir = Path(self.output_dir.get()) / "backup"
        if self.last_saved:
            backup_dir = Path(self.last_saved["backupDir"])
        backup_dir.mkdir(parents=True, exist_ok=True)
        try:
            if platform.system() == "Windows":
                os.startfile(backup_dir)  # type: ignore[attr-defined]
            elif platform.system() == "Darwin":
                subprocess.run(["open", str(backup_dir)], check=False)
            else:
                subprocess.run(["xdg-open", str(backup_dir)], check=False)
        except Exception as error:
            messagebox.showerror("백업 열기 실패", str(error))


def main() -> None:
    app = HoldingsFetcherApp()
    app.mainloop()
