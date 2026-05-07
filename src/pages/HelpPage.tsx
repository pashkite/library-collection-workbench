import { PageHeader } from '../components/PageHeader'

const sections = [
  {
    title: '처음 사용하는 방법',
    body: '앱을 열면 public/data/holdings.meta.json과 holdings.latest.json을 확인한 뒤 IndexedDB에 저장합니다. 준비 완료 후 홈으로 이동하세요.',
  },
  {
    title: '소장목록 기준일 확인',
    body: '홈과 설정 화면에서 데이터 기준일, 마지막 갱신일, 저장된 도서 건수, 도서관 코드를 확인할 수 있습니다.',
  },
  {
    title: '구입 후보 엑셀 업로드',
    body: '구입 후보 검토 화면에서 XLSX 또는 XLS 파일을 업로드합니다. ISBN 완전 일치와 서명·저자·출판사 유사 중복을 함께 확인합니다.',
  },
  {
    title: '엑셀 열 매핑',
    body: '도서명/서명/제목/자료명, 저자/저자명/지은이, 출판사/발행처/출판처, ISBN/국제표준도서번호, 가격/정가를 자동 인식하며 잘못 인식되면 직접 열을 지정할 수 있습니다.',
  },
  {
    title: '신간도서 조회',
    body: '신간도서 조회 화면에서 등록일 기간, 발행연도, KDC 대분류, 서지 조건으로 최근 소장자료를 좁히고 결과를 엑셀로 내려받을 수 있습니다.',
  },
  {
    title: '도서 선정 근거 확인',
    body: '구입 후보를 선정 근거 확인표로 불러와 추천도서, 세종도서, 문학상, 절판 여부, 저자 검토 상태, 담당자 메모를 기록하고 엑셀로 저장할 수 있습니다.',
  },
  {
    title: '알라딘 상세정보 조회',
    body: '설정 또는 조회 화면에 저장한 알라딘 TTB Key로 ISBN 상세정보를 조회합니다. 조회 결과는 브라우저에 7일 동안 캐시됩니다.',
  },
  {
    title: '개인정보 포함 파일 업로드 금지',
    body: '신청자명, 회원번호, 전화번호, 내부 검토 메모, 예산 메모, 담당자 메모, 민원 관련 정보가 포함된 파일은 업로드하지 마세요.',
  },
  {
    title: '검토 결과의 성격',
    body: '결과는 검토 보조 자료입니다. 최종 구입 여부와 추천도서 선정 여부는 담당자가 자료를 확인한 뒤 판단해야 합니다.',
  },
  {
    title: '오류 발생 시 조치',
    body: 'JSON 다운로드 실패 시 네트워크와 public/data 파일을 확인하세요. IndexedDB 오류가 반복되면 설정에서 캐시 삭제 후 다시 받기를 실행하세요.',
  },
]

export function HelpPage() {
  return (
    <div className="page-stack">
      <PageHeader title="도움말" description="도서관 장서 업무 보조 웹의 기본 사용 방법과 주의사항입니다." />
      <section className="help-list">
        {sections.map((section) => (
          <article className="panel" key={section.title}>
            <h2>{section.title}</h2>
            <p>{section.body}</p>
          </article>
        ))}
      </section>
    </div>
  )
}
