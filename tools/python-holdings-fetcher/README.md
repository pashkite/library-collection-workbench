# 정보나루 소장자료 Python GUI 수집기

GitHub Pages에서 정보나루 API를 직접 많이 호출하지 않도록, 최초 전체 소장자료 수집을 로컬 PC에서 수행하는 도구입니다. 결과는 기존 React/Vite 웹앱이 그대로 읽는 `public/data/holdings.latest.json`, `public/data/holdings.meta.json` 형식으로 저장됩니다.

## 설치

Python 3.10 이상을 권장합니다.

```bash
cd tools/python-holdings-fetcher
python -m venv .venv
```

Windows:

```bash
.venv\Scripts\activate
pip install -r requirements.txt
```

macOS, Linux:

```bash
source .venv/bin/activate
python3 -m pip install -r requirements.txt
```

WSL/Ubuntu에서 `tkinter`가 없다는 오류가 나면 아래 시스템 패키지도 필요합니다.

```bash
sudo apt install python3-tk
```

WSL에서 한글이 네모나 깨진 글자로 보이면 한글 폰트가 없는 상태입니다. 프로그램은 Windows의
`malgun.ttf`가 있으면 자동 등록을 시도합니다. 그래도 깨지면 아래 폰트를 설치하세요.

```bash
sudo apt install fonts-noto-cjk
```

## 실행

```bash
python3 main.py
```

또는 이 폴더에서 다음 명령으로도 실행할 수 있습니다.

```bash
python3 -m src
```

Windows PowerShell에서 실행할 때만 `python` 또는 `py` 명령을 사용하세요. WSL에서는 보통
`python` 명령이 없고 `python3`만 설치되어 있습니다.

## .env 자동 입력

프로젝트 루트의 `.env`에 아래 값이 있으면 GUI 입력창에 자동으로 채웁니다. 값은 로그와 저장 파일에 기록하지 않습니다.

- `DATA4LIBRARY_KEY` 또는 `LIBRARY_NARU_AUTH_KEY`
- `LIB_CODE` 또는 `DALSEONG_LIBRARY_CODE`
- `LIB_NAME`, `DALSEONG_LIBRARY_NAME`, `LIBRARY_NAME` 중 하나

## 기본 흐름

1. 정보나루 API 인증키, 도서관 코드, 도서관 이름을 입력합니다.
2. 저장 폴더와 로컬 `library-collection-workbench` Git 저장소 폴더를 선택합니다.
3. `외부 IP 확인`으로 현재 요청 IP를 확인합니다.
4. `API 응답 구조 확인`을 눌러 `debug_raw_itemSrch.json`을 저장하고 응답 필드를 확인합니다.
5. `전체 수집 시작`을 눌러 `itemSrch?type=ALL` 전체 소장자료를 수집합니다.
6. 수집 결과를 확인한 뒤 `JSON 저장` 또는 `Excel 저장`을 실행합니다.
7. `Git 반영 미리보기`로 기존/신규 건수를 확인하고 승인하면 로컬 저장소 `public/data`에 반영합니다.
8. `GitHub에 commit/push`를 누르면 로컬 Git 인증 상태를 사용해 `origin main`에 push합니다.

## 생성 파일

저장 폴더에는 다음 파일이 생성됩니다.

- `holdings.latest.json`
- `holdings.meta.json`
- `holdings.xlsx`
- `debug_raw_itemSrch.json`
- `backup/YYYYMMDD-HHMMSS/`

저장은 항상 임시 파일 검증 후 기존 파일을 백업하고 교체합니다. 실패하거나 수집이 중단되면 기존 JSON은 유지됩니다.

## 등록번호와 중복 제거

`API 응답 구조 확인`은 `docs.doc` 첫 번째 항목과 `callNumbers.callNumber` 내부 필드를 로그에 출력합니다. 아래 후보 필드를 탐색합니다.

- `registrationNumber`
- `regNo`
- `reg_no`
- `accessionNo`
- `accession_no`
- `controlNo`
- `등록번호`

등록번호가 확인되면 `reg:{libCode}:{registrationNumber}`를 우선 중복키로 사용합니다. 없으면 ISBN, 청구기호, 등록일, 도서명 등을 조합한 fallback `dedupeKey`를 사용합니다. ISBN 단독으로는 소장자료 중복 제거를 하지 않습니다.

## GitHub 반영

프로그램은 GitHub 토큰을 저장하지 않습니다. `git push origin main`이 가능한 상태로 로컬 Git 또는 GitHub CLI 인증을 미리 완료해야 합니다.

실행되는 명령은 다음과 같습니다.

```bash
git status
git add public/data/holdings.latest.json public/data/holdings.meta.json
git commit -m "Update holdings data from Python GUI YYYY-MM-DD"
git push origin main
```

push 실패 시 파일은 로컬 저장소에 남습니다. 오류 로그를 확인한 뒤 수동으로 처리할 수 있습니다.

## 주의

- API 인증키는 로그, 파일명, 저장 JSON에 기록하지 않습니다.
- 개인정보나 내부 검토 정보가 포함된 파일을 만들지 않습니다.
- 수집 결과는 업무 보조 자료입니다. 최종 반영 전 `holdings.xlsx`와 JSON 건수를 확인하세요.
