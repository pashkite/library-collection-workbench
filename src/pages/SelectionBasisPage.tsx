import { PlaceholderPage } from '../components/PlaceholderPage'

export function SelectionBasisPage() {
  // TODO Phase 3: 추천도서, 세종도서, 문학상, 절판 여부, 담당자 검토 메모를 연결한다.
  return (
    <PlaceholderPage
      title="도서 선정 근거 확인"
      phase="Phase 3"
      todos={[
        '추천도서, 세종도서, 문학상 확인',
        '절판 및 판매 상태 확인',
        '수동 확인 링크',
        '선정 근거 결과 엑셀 다운로드',
      ]}
    />
  )
}
