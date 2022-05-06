export const colors = {
  black_and_white: 'Black and White',
  black: 'Black',
  white: 'White',
  yellow: 'Yellow',
  orange: 'Orange',
  red: 'Red',
  purple: 'Purple',
  magenta: 'Magenta',
  green: 'Green',
  teal: 'Teal',
  blue: 'Blue'
}
export type Colors = keyof typeof colors

export const orderBys = {
  relevant: 'Relevant',
  latest: 'Latest'
}
export type OrderBys = keyof typeof orderBys

export const contentFilters = {
  low: 'Low',
  high: 'High'
}
export type ContentFilters = keyof typeof contentFilters

export const orientations = {
  landscape: 'Landscape',
  portrait: 'Portrait',
  squarish: 'Squarish'
}
export type Orientations = keyof typeof orientations
