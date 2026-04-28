import { PlaceholderPage } from '../components/PlaceholderPage'

export function NewReleasesPage() {
  // TODO Phase 2: KDC 필터, 등록일 범위 필터, 신간 기준 계산, 유사 중복 검토를 구현한다.
  return (
    <PlaceholderPage
      title="신간도서 조회"
      phase="Phase 2"
      todos={[
        '최근 30일, 60일, 90일, 6개월, 1년 필터',
        'KDC 대분류, 중분류, 소분류 필터',
        '청구기호에서 KDC 후보 추출',
        '등록번호 필터 조건부 활성화',
      ]}
    />
  )
}
