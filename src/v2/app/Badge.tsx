import clsx from 'clsx'
import type { ComponentPropsWithoutRef, ReactNode } from 'react'

import './Badge.css'

interface BadgeProps extends ComponentPropsWithoutRef<'div'> {
  label: string
  icon: ReactNode
  iconpos?: 'left' | 'right'
  appearence?: 'background' | 'outline' | 'plain' | 'default'
  status: 'success' | 'warning' | 'neutral' | 'danger'
}

export function Badge({
  label,
  icon,
  status,
  iconpos = 'left',
  appearence = 'default',
  ...props
}: BadgeProps) {
  return (
    <div
      data-status={status}
      data-appearence={appearence}
      className={clsx('alinea-rac-Badge', props.className)}
    >
      {iconpos === 'left' && icon}
      <p className="sublabel">{label}</p>
      {iconpos === 'right' && icon}
    </div>
  )
}
