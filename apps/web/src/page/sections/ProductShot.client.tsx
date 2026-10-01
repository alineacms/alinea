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
  zoom: string
  origin: string
}

interface StageState {
  active: View
  /** Shown before, it stays below and keeps its crop while the next fades in */
  previous: View
}

const start: View = {feature: '', shot: '0', zoom: '1', origin: '50% 50%'}

function viewOf(element: Element): View {
  const data = (name: string) => element.getAttribute(`data-${name}`)
  return {
    feature: data('feature') ?? '',
    shot: data('shot') ?? '0',
    zoom: data('zoom') ?? '1',
    origin: `${data('focus-x') ?? 50}% ${data('focus-y') ?? 50}%`
  }
}

/**
 * Shows the screenshot of the feature that is hovered or focused, marked by
 * `data-shot` on the feature, and zooms into its crop. The stylesheet shows
 * the matching screenshot.
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
  const style = {
    '--web-shot-zoom': active.zoom,
    '--web-shot-origin': active.origin,
    '--web-shot-previous-zoom': previous.zoom,
    '--web-shot-previous-origin': previous.origin
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
