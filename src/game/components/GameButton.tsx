import type { ButtonHTMLAttributes, PropsWithChildren } from 'react'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'gold' | 'ghost'
}

export function GameButton({
  children,
  variant = 'default',
  className = '',
  ...props
}: PropsWithChildren<Props>) {
  const variantClass = variant === 'default' ? '' : variant
  return (
    <button type="button" className={`game-button ${variantClass} ${className}`.trim()} {...props}>
      {children}
    </button>
  )
}
