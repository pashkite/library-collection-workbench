import type { CSSProperties, PropsWithChildren } from 'react'

interface Props {
  className?: string
  strong?: boolean
  style?: CSSProperties
}

export function GlassPanel({ children, className = '', strong = false, style }: PropsWithChildren<Props>) {
  return (
    <div className={`${strong ? 'glass-strong' : 'glass'} ${className}`.trim()} style={style}>
      {children}
    </div>
  )
}
