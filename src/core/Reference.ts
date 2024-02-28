// See implementations in picker.url and picker.entry
export interface Reference {
  _id: string
  _type: string
}

export namespace Reference {
  export const id = '_id' satisfies keyof Reference
  export const type = '_type' satisfies keyof Reference
}
