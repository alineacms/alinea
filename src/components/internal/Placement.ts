import type {Placement} from 'react-aria'
import type {Align, Side} from '../types.js'

export function placement(side?: Side, align?: Align): Placement | undefined {
  if (!side && !align) return undefined
  side ??= 'bottom'
  if (!align || align === 'center') return side
  if (side === 'top' || side === 'bottom') return `${side} ${align}`
  return `${side} ${align === 'start' ? 'top' : 'bottom'}`
}
