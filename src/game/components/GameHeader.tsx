interface Props {
  title: string
  subtitle?: string
}

export function GameHeader({ title, subtitle }: Props) {
  return (
    <div className="panel-title">
      <div>
        <h2>{title}</h2>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
    </div>
  )
}
