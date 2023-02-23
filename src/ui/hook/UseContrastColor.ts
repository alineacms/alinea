import {useMemo} from 'react'
import {contrastColor} from '../util/ContrastColor'

export function useContrastColor(color?: string): string | undefined {
  if (!color) return undefined
  return useMemo(() => contrastColor(color), [color])
}
