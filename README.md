# 도서관 장서 업무 보조 웹

공공도서관 종합자료실 장서 업무를 보조하는 React 기반 웹앱입니다. 소장목록 조회, 신간도서 필터링, 구입 후보 엑셀 중복 검토, 도서 선정 근거 확인, 알라딘 상세정보 조회, 데이터 관리 기능을 브라우저에서 처리합니다.

## 기술 스택

- React, Vite, TypeScript
- SheetJS
- IndexedDB (`idb`)
- GitHub Actions
- GitHub Pages 또는 Cloudflare Pages 배포 가능 구조

## 설치

```bash
npm install
```

일부 공유 저장소나 Android 동기화 폴더처럼 심볼릭 링크 생성이 제한된 환경에서는 다음 명령을 사용할 수 있습니다.

```bash
npm install --no-bin-links
```

## 실행

```bash
npm run dev
```

PowerShell 실행 정책 때문에 `npm.ps1`이 막히는 Windows 환경에서는 다음처럼 npm CLI를 직접 실행할 수 있습니다.

```bash
node "C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js" run dev
```

## 빌드와 검사

```bash
npm run build
npm run lint
```

## 주요 기능

- 앱 시작 시 `public/data/holdings.meta.json`, `public/data/holdings.latest.json`을 확인하고 IndexedDB에 저장
- 소장도서 도서명, 저자, 출판사, ISBN 검색
- 소장목록 전체 또는 검색 결과 엑셀 다운로드
- 신간도서 기간, KDC 대분류, 발행연도, 서지 조건 필터
- 구입 후보 XLSX/XLS 업로드와 자동/수동 열 매핑
- ISBN 완전 일치 중복 및 서명·저자·출판사 유사 중복 검토
- 구입 후보 검토 결과 엑셀 다운로드
- 도서 선정 근거 확인표 작성, 수동 확인 링크, 알라딘 보조 조회, 엑셀 다운로드
- 알라딘 TTB Key 기반 ISBN 상세정보 조회와 7일 캐시
- 설정 화면에서 IndexedDB 캐시 삭제, 전체 초기화, JSON 백업, 알라딘 키 저장

## 소장목록 갱신 구조

초기 전체 수집은 `tools/python-holdings-fetcher`의 Python GUI 또는 `scripts/fetchHoldingsFull.ts`에서 실행합니다. 결과물은 다음 파일에 반영됩니다.

- `public/data/holdings.latest.json`
- `public/data/holdings.meta.json`
- 검수용 `holdings.xlsx`

GitHub Actions의 `Update holdings JSON` 워크플로는 매일 증분 조회를 실행합니다. 기본 증분 조회는 최근 등록자료만 확인하고 기존 JSON과 병합합니다.

## 환경 변수

로컬 수집 스크립트와 Python GUI는 프로젝트 루트의 `.env`를 읽습니다. `.env`는 커밋하지 않습니다.

- `LIBRARY_NARU_AUTH_KEY` 또는 `DATA4LIBRARY_KEY`: 정보나루 API 인증키
- `DALSEONG_LIBRARY_CODE` 또는 `LIB_CODE`: 도서관 코드
- `LIB_NAME`: 도서관 표시명
- `ALADIN_TTB_KEY` 또는 `VITE_ALADIN_TTB_KEY`: 알라딘 TTB Key 기본값

GitHub Actions에서는 다음 값을 설정합니다.

- Secret: `DATA4LIBRARY_KEY`
- Variable: `LIB_CODE`
- Variable: `LIB_NAME`
- Variable: `DAILY_LOOKBACK_DAYS`
- Variable: `PAGE_SIZE`

## 공개 JSON 필드

`public/data/holdings.latest.json`에는 업무 공개용 필드만 포함합니다.

- 도서명 `title`
- 저자 `author`
- 출판사 `publisher`
- 출판연도 `publicationYear`
- ISBN `isbn`
- KDC `kdc`
- 청구기호 `callNumber`
- 배가명 `shelfName`
- 등록일 `registeredAt`
- 등록번호 `registrationNumber`
- 중복키 `dedupeKey`
- 도서관 코드와 이름 `libCode`, `libraryName`

신청자명, 회원번호, 전화번호, 내부 검토 메모, 예산 메모, 담당자 메모, 민원 관련 정보는 공개 JSON과 검토 결과에 기본 포함하지 않습니다.

## 주의사항

검토 결과는 업무 보조 자료입니다. 최종 구입 여부와 추천도서 선정 여부는 담당자가 관련 기준과 실제 서지를 확인해 판단해야 합니다.
