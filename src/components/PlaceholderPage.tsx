import { Construction } from 'lucide-react'
import { PageHeader } from './PageHeader'

interface PlaceholderPageProps {
  title: string
  phase: string
  todos: string[]
}

export function PlaceholderPage({ title, phase, todos }: PlaceholderPageProps) {
  return (
    <div className="page-stack">
      <PageHeader
        title={title}
        description={`${phase}에서 구현할 기능입니다. 이번 작업에서는 라우트, 컴포넌트 뼈대, 타입, TODO만 준비했습니다.`}
      />
      <section className="panel">
        <div className="section-title">
          <Construction size={18} aria-hidden="true" />
          <h2>TODO</h2>
        </div>
        <ul className="todo-list">
          {todos.map((todo) => (
            <li key={todo}>{todo}</li>
          ))}
        </ul>
      </section>
    </div>
  )
}
