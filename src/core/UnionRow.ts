export interface UnionRow {
  _id: string
  _type: string
}

export namespace UnionRow {
  export const id = '_id' satisfies keyof UnionRow
  export const type = '_type' satisfies keyof UnionRow
}

export interface UnionMutator<T extends UnionRow> {
  replace: (value: T | undefined) => void
}
