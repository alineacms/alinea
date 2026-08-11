const COLORS = [
  '#E94427',
  '#E72F53',
  '#E11F82',
  '#D21CA6',
  '#A92ED3',
  '#7741DE',
  '#1F7FE3',
  '#00A0C6',
  '#00A98A',
  '#14B65C',
  '#2CB93F',
  '#CD771F',
  '#EC730A',
  '#00A9D6',
  '#00B48A',
  '#88B800',
  '#E0AE00',
  '#E9840A',
  '#AD8A47'
]

// Source: https://github.com/microsoft/fluentui/blob/862d142c760b40df8c21a43b41bf513c153df69e/packages/react-avatar/src/components/Avatar/useAvatar.tsx#L144-L153
export function getRandomColor(sub: string) {
  let hashCode = 0
  for (let i = sub.length - 1; i >= 0; i--) {
    const ch = sub.charCodeAt(i)
    const shift = i % 8
    hashCode ^= (ch << shift) + (ch >> (8 - shift))
  }
  return COLORS[hashCode % COLORS.length]
}
