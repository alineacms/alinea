'use client'

import {
  type FocusEvent,
  type PointerEvent,
  type ReactNode,
  useState
} from 'react'

export interface ProductShotStageProps {
  className?: string
  children: ReactNode
}

interface StageState {
  active: string
  /** The screenshot shown before, it stays below while the next fades in */
  previous: string
}

/**
 * Shows the screenshot of the feature that is hovered or focused, marked by
 * `data-shot` on the feature, the stylesheet shows the matching screenshot
 */
export function ProductShotStage({className, children}: ProductShotStageProps) {
  const [{active, previous}, setState] = useState<StageState>({
    active: '0',
    previous: '0'
  })
  function select(event: PointerEvent | FocusEvent) {
    const target = event.target as Element
    const shot = target.closest('[data-shot]')?.getAttribute('data-shot')
    if (shot)
      setState(current =>
        current.active === shot
          ? current
          : {active: shot, previous: current.active}
      )
  }
  return (
    <div
      className={className}
      data-active={active}
      data-previous={previous}
      onPointerOver={select}
      onFocus={select}
    >
      {children}
    </div>
  )
}
