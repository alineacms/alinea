export function px(value: number | string): string {
  return typeof value === 'string' ? value : `${value / 16}rem`
}