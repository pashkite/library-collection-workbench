import { useMemo, useState } from 'react'
import {
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  Database,
  FileSpreadsheet,
  HelpCircle,
  RefreshCw,
  Search,
  Settings,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAppData } from '../lib/AppDataContext'
import type { DataMeta } from '../types/library'

function formatStatus(status?: DataMeta['status']) {
  switch (status) {
    case 'ready':
      return '정상'
    case 'updating':
      return '갱신 중'
    case 'failed':
      return '확인 필요'
    case 'sample':
      return '샘플'
    default:
      return '대기 중'
  }
}

function formatDateTime(value?: string) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('ko-KR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

export function HomePage() {
  const { data, refreshData } = useAppData()
  const [query, setQuery] = useState('')
  const status = formatStatus(data.meta?.status)
  const lastUpdatedAt = formatDateTime(data.meta?.lastUpdatedAt)
  const baseDate = data.meta?.baseDate ?? '-'
  const totalCount = data.totalCount.toLocaleString()

  const boardRows = useMemo(
    () => [
      {
        no: '공지',
        category: '안내',
        title: '장서 업무 시작 전 데이터 기준일과 소장 건수를 확인해 주세요.',
        note: `현재 ${data.meta?.libraryName ?? '공공도서관'} 데이터 상태는 “${status}”입니다.`,
        to: '/help',
        state: status,
        basis: baseDate,
        notice: true,
      },
      {
        no: '107',
        category: '소장',
        title: '소장도서 조회',
        note: '서명·저자·출판사·ISBN·청구기호로 전체 소장목록을 검색합니다.',
        to: '/holdings',
        state: '검색',
        basis: `${totalCount}권`,
      },
      {
        no: '106',
        category: '신간',
        title: '신간도서 조회',
        note: '기간, KDC 대분류, 발행연도와 서지 조건으로 최근 자료를 추립니다.',
        to: '/new-releases',
        state: '조회',
        basis: '최근 등록',
      },
      {
        no: '105',
        category: '구입',
        title: '구입 후보 검토',
        note: '후보 엑셀을 올려 ISBN 일치와 서명·저자·출판사 유사 중복을 확인합니다.',
        to: '/purchase-review',
        state: '업로드',
        basis: 'XLSX',
      },
      {
        no: '104',
        category: '선정',
        title: '도서 선정 근거 확인',
        note: '선정 사유와 확인 링크를 정리하고 검토표를 엑셀로 저장합니다.',
        to: '/selection-basis',
        state: '작성',
        basis: '검토표',
      },
      {
        no: '103',
        category: '조회',
        title: '알라딘 상세정보 조회',
        note: 'ISBN을 기준으로 표지와 책 소개 등 보조 서지정보를 확인합니다.',
        to: '/aladin',
        state: '외부조회',
        basis: 'ISBN',
      },
      {
        no: '102',
        category: '시스템',
        title: '데이터 및 연동 설정',
        note: '브라우저 캐시, JSON 백업과 알라딘 TTB Key를 관리합니다.',
        to: '/settings',
        state: '설정',
        basis: '브라우저 저장',
      },
      {
        no: '101',
        category: '도움',
        title: '사용 방법과 주의사항',
        note: '각 업무 화면의 처리 순서와 최종 확인이 필요한 항목을 안내합니다.',
        to: '/help',
        state: '안내',
        basis: '사용법',
      },
    ],
    [baseDate, data.meta?.libraryName, status, totalCount],
  )

  const normalizedQuery = query.trim().toLocaleLowerCase('ko-KR')
  const filteredRows = normalizedQuery
    ? boardRows.filter((row) =>
        `${row.category} ${row.title} ${row.note} ${row.state} ${row.basis}`
          .toLocaleLowerCase('ko-KR')
          .includes(normalizedQuery),
      )
    : boardRows

  return (
    <div className="gallery-home">
      <section className="gallery-titlebar">
        <div>
          <p>도서관 업무 게시판</p>
          <h1>장서 업무 갤러리</h1>
          <span>업무 화면을 게시글 목록처럼 빠르게 찾아 들어갈 수 있습니다.</span>
        </div>
        <span className={`gallery-title-status status-${data.meta?.status ?? 'idle'}`}>
          <CheckCircle2 size={15} aria-hidden="true" />
          데이터 {status}
        </span>
      </section>

      <div className="gallery-home-grid">
        <section className="gallery-board" aria-label="장서 업무 목록">
          <div className="gallery-board-toolbar">
            <div className="gallery-board-tabs" aria-label="게시판 분류">
              <strong>전체글</strong>
              <span>공지</span>
              <span>업무도구</span>
            </div>
            <span>총 {filteredRows.length}개 메뉴</span>
          </div>

          <div className="gallery-board-scroll">
            <table className="gallery-board-table">
              <colgroup>
                <col className="col-no" />
                <col className="col-category" />
                <col />
                <col className="col-state" />
                <col className="col-basis" />
              </colgroup>
              <thead>
                <tr>
                  <th>번호</th>
                  <th>분류</th>
                  <th>제목</th>
                  <th>상태</th>
                  <th>기준</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <tr key={row.no} className={row.notice ? 'is-notice' : undefined}>
                    <td className="board-no">{row.no}</td>
                    <td className="board-category">{row.category}</td>
                    <td className="board-subject">
                      <Link to={row.to}>
                        <strong>{row.title}</strong>
                        <span>{row.note}</span>
                      </Link>
                    </td>
                    <td className="board-state">{row.state}</td>
                    <td className="board-basis">{row.basis}</td>
                  </tr>
                ))}
                {filteredRows.length === 0 ? (
                  <tr>
                    <td className="gallery-board-empty" colSpan={5}>
                      검색어와 일치하는 업무 메뉴가 없습니다.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <form className="gallery-board-search" onSubmit={(event) => event.preventDefault()}>
            <label htmlFor="home-board-search">업무 메뉴 검색</label>
            <div>
              <span className="gallery-search-select">제목+내용</span>
              <input
                id="home-board-search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="검색어를 입력하세요"
              />
              <button type="submit" aria-label="업무 메뉴 검색">
                <Search size={16} aria-hidden="true" />
                검색
              </button>
            </div>
          </form>
        </section>

        <aside className="gallery-side-column" aria-label="장서 데이터 요약">
          <section className="gallery-side-card">
            <h2>갤러리 정보</h2>
            <dl className="gallery-info-list">
              <div>
                <dt>도서관</dt>
                <dd>{data.meta?.libraryName ?? '공공도서관'}</dd>
              </div>
              <div>
                <dt>기준일</dt>
                <dd>{baseDate}</dd>
              </div>
              <div>
                <dt>소장 건수</dt>
                <dd>{totalCount}권</dd>
              </div>
              <div>
                <dt>최근 갱신</dt>
                <dd>{lastUpdatedAt}</dd>
              </div>
            </dl>
            <button type="button" className="gallery-refresh-button" onClick={() => void refreshData()}>
              <RefreshCw size={15} aria-hidden="true" />
              데이터 다시 확인
            </button>
          </section>

          <section className="gallery-side-card">
            <h2>업무 바로가기</h2>
            <div className="gallery-quick-list">
              <Link to="/holdings">
                <Database size={15} aria-hidden="true" /> 소장목록 검색
              </Link>
              <Link to="/new-releases">
                <BookOpen size={15} aria-hidden="true" /> 신간 자료 확인
              </Link>
              <Link to="/purchase-review">
                <ClipboardCheck size={15} aria-hidden="true" /> 구입 후보 검토
              </Link>
              <Link to="/selection-basis">
                <FileSpreadsheet size={15} aria-hidden="true" /> 선정 근거 작성
              </Link>
              <Link to="/settings">
                <Settings size={15} aria-hidden="true" /> 데이터 설정
              </Link>
              <Link to="/help">
                <HelpCircle size={15} aria-hidden="true" /> 도움말
              </Link>
            </div>
          </section>

          <section className="gallery-side-card gallery-workflow-card">
            <h2>권장 업무 순서</h2>
            <ol>
              <li><span>1</span> 후보 목록 준비</li>
              <li><span>2</span> 소장·유사 중복 확인</li>
              <li><span>3</span> 선정 근거 기록</li>
              <li><span>4</span> 결과 파일 저장</li>
            </ol>
          </section>
        </aside>
      </div>
    </div>
  )
}
