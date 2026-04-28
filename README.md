# 도서관 장서 업무 보조 웹

공공도서관 종합자료실 업무를 위한 정적 웹앱입니다. 1차 버전은 소장도서 조회, 구입 후보 ISBN 중복 검토, 설정, 도움말을 실제로 동작하게 만들고, 신간도서 조회·도서 선정 근거·알라딘 상세정보·GPT 연계 내보내기는 이후 Phase에서 확장할 수 있게 라우트와 타입 뼈대를 준비합니다.

## 기술 스택

- React, Vite, TypeScript
- SheetJS
- IndexedDB (`idb`)
- GitHub Actions
- GitHub Pages 또는 Cloudflare Pages 배포 가능 구조

## 설치 방법

```bash
npm install
```

Android 공유 저장소처럼 심볼릭 링크나 네이티브 실행 파일 실행이 제한된 환경에서는 아래 명령을 사용할 수 있습니다.

```bash
npm install --no-bin-links
```

## 개발 서버 실행 방법

```bash
npm run dev
```

## 빌드 방법

```bash
npm run build
```

## 배포 방법

GitHub Pages는 `.github/workflows/deploy-pages.yml` 워크플로가 `main` 브랜치 push 시 자동으로 `npm run build`를 실행하고 `dist` 폴더를 배포합니다. Vite `base`는 `/library-collection-workbench/`로 설정되어 있습니다. Hash Router를 사용하므로 별도 서버 rewrite 설정 없이 새로고침 문제가 적습니다.

Cloudflare Pages는 빌드 명령을 `npm run build`, 배포 디렉터리를 `dist`로 설정합니다.

## GitHub Actions Secrets 설정

저장소 Settings → Secrets and variables → Actions에서 아래 값을 설정합니다.

- `DATA4LIBRARY_KEY`: 정보나루 API 인증키. 코드에 직접 넣지 않습니다.
- `LIB_CODE`: Actions Variables에 설정하는 도서관 코드입니다. 없으면 `sample`로 동작합니다.
- `LIB_NAME`: Actions Variables에 설정하는 도서관 표시명입니다. 없으면 `달성군립도서관`을 사용합니다.

수동 갱신은 Actions 탭에서 `Update holdings JSON` 워크플로를 실행합니다. 정기 갱신은 주 1회 실행됩니다.

## 공개 JSON 필드

`public/data/holdings.latest.json`에는 아래 필드만 포함합니다.

- 도서명: `title`
- 저자: `author`
- 출판사: `publisher`
- 출판연도: `publicationYear`
- ISBN: `isbn`
- KDC: `kdc`
- 청구기호: `callNumber`
- 배가명: `shelfName`
- 등록일: `registeredAt`

신청자명, 회원번호, 전화번호, 내부 검토 메모, 예산 관련 메모, 담당자 메모, 민원 관련 정보, 등록번호는 기본 포함하지 않습니다. 등록번호는 향후 내부 업로드 데이터가 있을 때만 선택적으로 처리할 수 있도록 타입만 열어두었습니다.

## 개인정보 주의

개인정보나 내부 검토 정보가 포함된 파일은 업로드하지 마세요. 이 앱은 브라우저 IndexedDB를 사용하지만, 업무 안전을 위해 공개 JSON, GPT용 출력, 엑셀 결과에도 개인정보를 기본 포함하지 않는 구조로 설계했습니다.

검토 결과는 업무 보조 자료입니다. 최종 구입 여부와 추천도서 선정 여부는 담당자가 확인 후 판단해야 합니다.

## 현재 구현된 기능

- 최초 실행 또는 데이터 갱신 시 로딩 화면 표시
- `public/data/holdings.meta.json`, `public/data/holdings.latest.json` 읽기
- 소장목록 IndexedDB 저장 및 정규화 필드 생성
- 소장도서 도서명·저자·출판사·ISBN 검색
- 검색 결과 50/100/200건 페이지 표시
- 전체 소장목록 및 검색 결과 엑셀 다운로드
- 구입 후보 XLSX/XLS 업로드
- 엑셀 열 이름 자동 인식
- ISBN 완전 일치 중복 검토
- 구입 후보 검토 결과 엑셀 다운로드
- 설정 화면의 기준일, 건수, 저장공간, 캐시 삭제, 전체 초기화, 알라딘 TTB Key 저장
- JSON 백업 다운로드
- 도움말과 한국어 오류 안내
- 주 1회 GitHub Actions 소장목록 갱신 구조

## TODO 기능

- 수동 엑셀 열 매핑 UI
- KDC 대·중·소분류 필터와 `src/data/kdc6.json` 상세 매핑
- 신간도서 조회와 기간 필터
- 도서명·저자 유사 중복 검토
- 알라딘 상세정보 API 연동과 조회 캐시
- 도서 선정 근거 확인
- GPT 연계용 Markdown, CSV, JSON 내보내기
- 대용량 표 가상화와 Web Worker 기반 엑셀 생성

## Phase별 개발 계획

- Phase 0: React + Vite + TypeScript 구조, 라우트, 타입, 폴더 구조, 빌드 가능 상태
- Phase 1: 소장목록 로딩, IndexedDB 저장, 검색, 엑셀 다운로드, 구입 후보 ISBN 중복 검토, 설정, 도움말
- Phase 2: KDC·신간·필터 고도화, 등록번호 조건부 필터, 유사 중복 검토
- Phase 3: 알라딘 API, 상세정보 조회, 도서 선정 근거 확인, 담당자 검토 메모
- Phase 4: GPT 연계용 Markdown/CSV/JSON 내보내기, 프롬프트 생성, 복사 패널
- Phase 5: 데이터 검증·복구, 오류 안내 개선, 대용량 성능 최적화, 운영 편의 기능

## 샘플 데이터

- `public/data/holdings.latest.json`
- `public/data/holdings.meta.json`
- `public/sample/sample_holdings_100.json`
- `public/sample/sample_purchase_candidates.xlsx`

샘플 데이터에는 실제 내부자료나 개인정보를 넣지 않습니다.
