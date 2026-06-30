export interface ListRow {
  _id: string
  _type: string
  _index: string
}

export namespace ListRow {
  export const id = '_id' satisfies keyof ListRow
  export const index = '_index' satisfies keyof ListRow
  export const type = '_type' satisfies keyof ListRow
}
