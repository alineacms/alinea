import {getLuminance} from 'color2k'
import {useMemo} from 'react'

export function useContrastColor(color?: string): string | undefined {
  if (!color) return undefined
  return useMemo(() => {
    try {
      return getLuminance(color) > 0.5 ? '#11181c' : 'white'
    } catch (e) {
      // Failed to parse color
      return '#11181c'
    }
  }, [color])
}
