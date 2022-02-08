const COLORS = [
  '#EA9280',
  '#EB9091',
  '#E58FB1',
  '#E38EC3',
  '#CF91D8',
  '#BE93E4',
  '#AA99EC',
  '#8DA4EF',
  '#5EB0EF',
  '#3DB9CF',
  '#53B9AB',
  '#5BB98C',
  '#65BA75',
  '#D09E72',
  '#FA934E',
  '#2EBDE5',
  '#40C4AA',
  '#94BA2C',
  '#EBBC00',
  '#EE9D2B',
  '#B8A383'
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
