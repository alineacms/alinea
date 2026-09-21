export interface ListRow {
  _id: string
  _type: string
  _index: string
  _anchor?: string
  _label?: string
  _layout?: ListRowLayout
}

export interface ListRowLayout {
  row: string
  span: number
}

export namespace ListRow {
  export const id = '_id' satisfies keyof ListRow
  export const index = '_index' satisfies keyof ListRow
  export const layout = '_layout' satisfies keyof ListRow
  export const type = '_type' satisfies keyof ListRow
}
