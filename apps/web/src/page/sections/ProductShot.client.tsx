'use client'

import {
  type CSSProperties,
  type FocusEvent,
  type PointerEvent,
  type ReactNode,
  useState
} from 'react'

export interface ProductShotStageProps {
  className?: string
  children: ReactNode
}

interface View {
  /** The feature, the screenshot and the crop it zooms into */
  feature: string
  shot: string
  zoom: number
  /** The focus point as an offset from the center, in percent of the shot */
  x: number
  y: number
}

interface StageState {
  active: View
  /** Shown before, it stays below while the next fades in */
  previous: View
}

const start: View = {feature: '', shot: '0', zoom: 1, x: 0, y: 0}

function viewOf(element: Element): View {
  const data = (name: string) => element.getAttribute(`data-${name}`)
  return {
    feature: data('feature') ?? '',
    shot: data('shot') ?? '0',
    zoom: Number(data('zoom') ?? 1),
    x: Number(data('focus-x') ?? 50) - 50,
    y: Number(data('focus-y') ?? 50) - 50
  }
}

/**
 * Shows the screenshot of the feature that is hovered or focused, marked by
 * `data-shot` on the feature, and zooms into its crop. All screenshots follow
 * the same view, so moving between features pans and zooms from where the
 * view is instead of starting over. The stylesheet shows the matching shot.
 */
export function ProductShotStage({className, children}: ProductShotStageProps) {
  const [{active, previous}, setState] = useState<StageState>({
    active: start,
    previous: start
  })
  function select(event: PointerEvent | FocusEvent) {
    const target = (event.target as Element).closest('[data-shot]')
    if (!target) return
    const next = viewOf(target)
    setState(current =>
      current.active.feature === next.feature
        ? current
        : {active: next, previous: current.active}
    )
  }
  // Zooming around the focus point is a scale around the center plus this
  // shift: animating it moves the view smoothly, unlike transform-origin
  const shift = 1 - active.zoom
  const style = {
    '--web-shot-zoom': active.zoom,
    '--web-shot-x': `${shift * active.x}%`,
    '--web-shot-y': `${shift * active.y}%`
  } as CSSProperties
  return (
    <div
      className={className}
      style={style}
      data-active={active.shot}
      data-previous={previous.shot}
      data-feature={active.feature}
      onPointerOver={select}
      onFocus={select}
    >
      {children}
    </div>
  )
}
