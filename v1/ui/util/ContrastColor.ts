import {getLuminance} from 'color2k'

export function contrastColor(color?: string): string | undefined {
  if (!color) return undefined
  try {
    return getLuminance(color) > 0.5 ? '#11181c' : 'white'
  } catch (e) {
    // Failed to parse color
    return undefined
  }
}
